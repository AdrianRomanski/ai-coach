import { parseArgs } from 'node:util';
import { ExternalJudge } from '@ai-coach/external-judge';
import {
  OllamaChatModel,
  SparringModelError,
  type ChatModel,
} from '@ai-coach/sparring-partner';
import { VaultClient, VaultToolError } from '@ai-coach/vault-client';
import {
  ConfigError,
  loadConfig,
  ollamaOptions,
  type CoachConfig,
} from './config.js';
import { CommandError, type CoachContext, type Judge } from './context.js';
import { localDate } from './history.js';
import { judge } from './judge.js';
import { PendingQueue } from './pending.js';
import { spar } from './spar.js';
import { paint, type Terminal } from './terminal.js';
import {
  archive,
  capture,
  due,
  file,
  init,
  list,
  view,
} from './vault-commands.js';

export const USAGE = `coach: a Socratic sparring partner for your notes

  coach [due]                 what is due for review, and what was never sparred
  coach list                  every Resources note with its mastery
  coach spar [ref ...]        Tier 1, offline: spar due notes, or notes by path or coach_id
  coach judge [session ...]   Tier 2, online: judge the Tier 1 sessions waiting for it
  coach file <note> <folder>  move a note into a PARA folder (shows a preview first)
  coach capture <title>       write a new note into 0.Inbox
  coach archive <project>     move a project from 1.Projects into 4.Archive
  coach init                  bring the vault onto the five PARA folders
  coach view                  open the vault graph in the browser

Options: --config <file>, --today YYYY-MM-DD, --help`;

export interface CliDeps {
  term: Terminal;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  connect?: (config: CoachConfig) => Promise<VaultClient>;
  chatModel?: (config: CoachConfig) => ChatModel;
  judge?: (config: CoachConfig) => Judge;
}

const VAULT_COMMANDS = new Set([
  'due',
  'list',
  'spar',
  'judge',
  'file',
  'capture',
  'archive',
  'init',
]);

function defaultJudge(config: CoachConfig): Judge {
  return new ExternalJudge({
    model: config.judge.model,
    fallbackModel: config.judge.fallbackModel,
    thinkingLevel: config.judge.thinkingLevel,
  });
}

export async function run(argv: string[], deps: CliDeps): Promise<number> {
  const { term } = deps;
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        config: { type: 'string' },
        today: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (err) {
    term.print(`${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const [command = 'due', ...args] = parsed.positionals;
  if (parsed.values.help || command === 'help') {
    term.print(USAGE);
    return 0;
  }
  if (command !== 'view' && !VAULT_COMMANDS.has(command)) {
    term.print(`Unknown command: ${command}\n\n${USAGE}`);
    return 2;
  }
  const today = parsed.values.today;
  if (today && !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    term.print('--today must be YYYY-MM-DD');
    return 2;
  }

  let vault: VaultClient | undefined;
  try {
    const config = loadConfig({
      file: parsed.values.config,
      env: deps.env,
      cwd: deps.cwd,
    });
    if (command === 'view') {
      await view({ config, term } as CoachContext);
      return 0;
    }
    vault = await (
      deps.connect ??
      ((c) => VaultClient.connect({ serverBin: c.docsMcpBin, vault: c.vault }))
    )(config);
    const ctx: CoachContext = {
      config,
      vault,
      term,
      pending: new PendingQueue(config.stateDir),
      today: () => today ?? localDate(),
      chatModel: () =>
        (deps.chatModel ?? ((c) => new OllamaChatModel(ollamaOptions(c))))(
          config,
        ),
      judge: async () => (deps.judge ?? defaultJudge)(config),
    };
    switch (command) {
      case 'due':
        await due(ctx);
        break;
      case 'list':
        await list(ctx);
        break;
      case 'spar':
        await spar(ctx, args);
        break;
      case 'judge':
        await judge(ctx, args);
        break;
      case 'file':
        await file(ctx, args);
        break;
      case 'capture':
        await capture(ctx, args);
        break;
      case 'archive':
        await archive(ctx, args);
        break;
      case 'init':
        await init(ctx);
        break;
    }
    return 0;
  } catch (err) {
    const known =
      err instanceof CommandError ||
      err instanceof ConfigError ||
      err instanceof VaultToolError ||
      err instanceof SparringModelError;
    term.print(
      paint(
        'red',
        known ? (err as Error).message : String((err as Error)?.stack ?? err),
      ),
    );
    return 1;
  } finally {
    await vault?.close();
  }
}

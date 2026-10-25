import { parseArgs } from 'node:util';
import { OfflineViolationError } from '@ai-coach/adapter-ollama';
import { ApplicationError } from '@ai-coach/application';
import {
  COACHING_STYLES,
  DomainError,
  isCoachingStyle,
} from '@ai-coach/domain';
import {
  archive,
  capture,
  due,
  file,
  init,
  judge,
  list,
  spar,
  study,
  UsageError,
  view,
  type CommandOptions,
} from './commands.js';
import {
  composeCoach,
  type AdapterOverrides,
  type Coach,
} from './composition.js';
import { distill } from './distill.js';
import { ConfigError, loadConfig } from './config.js';
import { paint, type Terminal } from './terminal.js';

export const USAGE = `coach: a Socratic sparring partner for your notes

  coach [due]                 what is due for review, and what was never sparred
  coach list                  every Resources note with its mastery
  coach spar [ref ...]        Tier 1, offline: spar due notes, or notes by path or coach_id
  coach judge [session ...]   Tier 2, online: judge the Tier 1 sessions waiting for it
  coach study <ref>           work through the gaps of a chapter's latest failed session
  coach distill [book]        turn your marks and reading notes on a book into concept notes
  coach file <note> <folder>  move a note into a PARA folder (shows a preview first)
  coach capture <title>       write a new note into 0.Inbox
  coach archive <project>     move a project from 1.Projects into 4.Archive
  coach init                  bring the vault onto the five PARA folders
  coach view                  open the vault graph in the browser

Options: --style feynman|socratic|cornell|devil, --config <file>, --today YYYY-MM-DD, --help

Styles: feynman (plain words, no jargon), socratic (counter-examples), cornell (the author's thesis and argument), devil (failure modes and trade-offs).
Without --style, a note's style: frontmatter, then sparring.style in the config, then automatic choice.`;

export interface CliDeps extends AdapterOverrides {
  term: Terminal;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

const COMMANDS: Record<
  string,
  (
    coach: Coach,
    term: Terminal,
    args: string[],
    options: CommandOptions,
  ) => Promise<void>
> = {
  due: (coach, term) => due(coach, term),
  list: (coach, term) => list(coach, term),
  spar,
  judge,
  study,
  distill,
  file,
  capture,
  archive,
  init: (coach, term) => init(coach, term),
};

function isKnown(err: unknown): err is Error {
  return (
    err instanceof ApplicationError ||
    err instanceof DomainError ||
    err instanceof ConfigError ||
    err instanceof UsageError ||
    err instanceof OfflineViolationError
  );
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
        style: { type: 'string' },
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
  const handler = COMMANDS[command];
  if (!handler && command !== 'view') {
    term.print(`Unknown command: ${command}\n\n${USAGE}`);
    return 2;
  }
  const style = parsed.values.style;
  if (style !== undefined && !isCoachingStyle(style)) {
    term.print(`--style must be one of ${COACHING_STYLES.join(', ')}`);
    return 2;
  }
  const today = parsed.values.today;
  if (today && !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    term.print('--today must be YYYY-MM-DD');
    return 2;
  }

  let coach: Coach | undefined;
  try {
    const config = loadConfig({
      file: parsed.values.config,
      env: deps.env,
      cwd: deps.cwd,
    });
    if (!handler) {
      await view(config, term);
      return 0;
    }
    coach = await composeCoach(config, today, deps);
    await handler(coach, term, args, { style });
    return 0;
  } catch (err) {
    term.print(
      paint(
        'red',
        isKnown(err) ? err.message : String((err as Error)?.stack ?? err),
      ),
    );
    return 1;
  } finally {
    await coach?.close();
  }
}

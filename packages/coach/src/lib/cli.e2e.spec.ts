import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  ExternalJudge,
  type GenAIClient,
  type GenerateContentRequest,
} from '@ai-coach/external-judge';
import type { ChatModel, ChatRequest } from '@ai-coach/sparring-partner';
import { VaultClient } from '@ai-coach/vault-client';
import { run } from './cli.js';
import { PendingQueue } from './pending.js';
import type { Terminal } from './terminal.js';

const SERVER_BIN =
  process.env['DOCS_MCP_BIN'] ??
  resolve(
    import.meta.dirname,
    '../../../../../kb-template/packages/cli/bin/docs-mcp.js',
  );

const EVENT_LOOP = '3.Resources/TS/Event loop.md';
const PROMISES = '3.Resources/TS/Promises.md';
const PRIVATE_LINE = 'PRIVATE-NOTE-LINE-c0ffee';

class ScriptedTerminal implements Terminal {
  readonly output: string[] = [];
  private inputs: string[] = [];

  feed(...lines: string[]): void {
    this.inputs.push(...lines);
  }

  print(text = ''): void {
    this.output.push(text);
  }

  async ask(prompt: string): Promise<string | null> {
    this.output.push(prompt);
    return this.inputs.length ? this.inputs.shift()! : null;
  }

  text(): string {
    return this.output.join('\n').replace(/\x1b\[[0-9;]*m/g, '');
  }

  reset(): void {
    this.output.length = 0;
    this.inputs = [];
  }
}

class ScriptedGemma implements ChatModel {
  readonly replies: unknown[] = [];
  async chat(_request: ChatRequest): Promise<string> {
    if (!this.replies.length)
      throw new Error('ScriptedGemma ran out of replies');
    return JSON.stringify(this.replies.shift());
  }
}

class FakeGemini implements GenAIClient {
  readonly requests: GenerateContentRequest[] = [];
  readonly replies: unknown[] = [];
  readonly models = {
    generateContent: async (request: GenerateContentRequest) => {
      this.requests.push(request);
      return { text: JSON.stringify(this.replies.shift()) };
    },
  };
}

const conclude = (verdict: 'pass' | 'fail') => ({
  action: 'conclude',
  question: '',
  verdict,
  gaps: verdict === 'pass' ? [] : ['No mechanism'],
  feedback: verdict === 'pass' ? 'Clear.' : 'Missing the mechanism.',
});

const cleanJudgement = {
  claims: [
    {
      text: 'Microtasks run before timers.',
      kind: 'mechanism',
      supported: true,
      fallacies: [],
      handWave: false,
    },
  ],
  gaps: [],
  verdict: 'pass',
  reason: 'Explains the ordering.',
};

describe('coach CLI end to end', () => {
  const term = new ScriptedTerminal();
  const gemma = new ScriptedGemma();
  const gemini = new FakeGemini();
  const realFetch = globalThis.fetch;
  let root: string;
  let env: NodeJS.ProcessEnv;

  const coach = (...argv: string[]) =>
    run(argv, {
      term,
      env,
      cwd: root,
      chatModel: () => gemma,
      judge: () => new ExternalJudge({ client: gemini }),
    });

  const readNote = async (path: string) => {
    const vault = await VaultClient.connect({
      serverBin: SERVER_BIN,
      vault: join(root, 'vault'),
    });
    try {
      return await vault.readNote(path);
    } finally {
      await vault.close();
    }
  };

  beforeAll(async () => {
    if (!existsSync(SERVER_BIN))
      throw new Error(`Vault server not found at ${SERVER_BIN}`);
    root = await mkdtemp(join(tmpdir(), 'ai-coach-cli-'));
    const vault = join(root, 'vault');
    const notes: Record<string, string> = {
      [EVENT_LOOP]: `Microtasks drain before the next macrotask.\n${PRIVATE_LINE}\n`,
      [PROMISES]: 'A promise settles once.\n',
      '0.Inbox/Idea.md': 'Raw idea.\n',
    };
    for (const folder of [
      '0.Inbox',
      '1.Projects',
      '2.Areas',
      '3.Resources',
      '4.Archive',
    ]) {
      await mkdir(join(vault, folder), { recursive: true });
    }
    for (const [path, body] of Object.entries(notes)) {
      await mkdir(dirname(join(vault, path)), { recursive: true });
      await writeFile(join(vault, path), body);
    }
    env = {
      DOCS_MCP_BIN: SERVER_BIN,
      DOCS_MCP_VAULT: vault,
      XDG_CONFIG_HOME: join(root, 'config'),
      XDG_STATE_HOME: join(root, 'state'),
    };
  }, 30_000);

  beforeEach(() => term.reset());

  afterAll(async () => {
    globalThis.fetch = realFetch;
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('shows what is due', async () => {
    expect(await coach('--today', '2026-10-24')).toBe(0);
    expect(term.text()).toContain('Due on 2026-10-24: 0');
    expect(term.text()).toContain('Never sparred: 2');
  });

  it('spars offline, makes the learner rephrase buzzwords, and records Tier 1', async () => {
    globalThis.fetch = (async () => {
      throw new Error('network used during Tier 1');
    }) as typeof fetch;
    gemma.replies.push(
      { challenge: 'What decides which queued callback runs next, and why?' },
      {
        action: 'probe',
        question: 'What would starve if that order flipped?',
        verdict: 'fail',
        gaps: [],
        feedback: '',
      },
      conclude('pass'),
      { challenge: 'Why can a promise not change its mind?' },
    );
    term.feed(
      '',
      'It just works, magic.',
      '',
      'Promise callbacks are microtasks.',
      'They run before any timer.',
      '',
      'Timer callbacks would wait behind every chained promise.',
      '',
      '/skip',
      '',
    );

    expect(await coach('spar', '--today', '2026-10-24')).toBe(0);
    globalThis.fetch = realFetch;

    const out = term.text();
    expect(out).toContain('No buzzwords: magic');
    expect(out).toContain('What would starve if that order flipped?');
    expect(out).toContain('Tier 1 pass');
    expect(out).toContain('Event loop: pass, next review 2026-10-27');
    expect(out).not.toContain('Promises: ');

    const pending = new PendingQueue(join(root, 'state', 'ai-coach')).list();
    expect(pending).toHaveLength(1);
    const note = await readNote(EVENT_LOOP);
    expect(pending[0]!.coachIds).toEqual([note.coachId]);
    expect(note.history.entries).toEqual([
      expect.objectContaining({
        tier: 1,
        verdict: 'pass',
        next_review: '2026-10-27',
      }),
    ]);
  });

  it('judges the waiting session online and starts the ladder at 7 days', async () => {
    gemini.replies.push({ items: [cleanJudgement] });
    term.feed('');

    expect(await coach('judge', '--today', '2026-10-24')).toBe(0);

    expect(term.text()).toContain('Tier 2 pass');
    expect(term.text()).toContain('next review 2026-10-31');
    expect(new PendingQueue(join(root, 'state', 'ai-coach')).list()).toEqual(
      [],
    );

    const sent = JSON.stringify(gemini.requests);
    expect(sent).toContain('Promise callbacks are microtasks.');
    for (const secret of [
      PRIVATE_LINE,
      'Microtasks drain before',
      EVENT_LOOP,
      'Event loop',
    ]) {
      expect(sent).not.toContain(secret);
    }
    const note = await readNote(EVENT_LOOP);
    expect(note.history.mastery).toBe('tier2_passed');
  });

  it('climbs the ladder from the vault history on the next round', async () => {
    const coachId = (await readNote(EVENT_LOOP)).coachId!;
    gemma.replies.push(
      { challenge: 'Walk me through what runs after a resolved promise.' },
      conclude('pass'),
    );
    gemini.replies.push({ items: [cleanJudgement] });
    term.feed(
      'The callback is queued as a microtask and runs before timers.',
      '',
      '',
    );
    expect(await coach('spar', coachId, '--today', '2026-10-31')).toBe(0);

    term.feed('');
    expect(await coach('judge', '--today', '2026-10-31')).toBe(0);
    expect(term.text()).toContain('next review 2026-11-14');

    const entries = (await readNote(EVENT_LOOP)).history.entries;
    expect(entries.map((e) => [e.tier, e.next_review])).toEqual([
      [1, '2026-10-27'],
      [2, '2026-10-31'],
      [1, '2026-11-03'],
      [2, '2026-11-14'],
    ]);
  });

  it('shows a filing preview and moves nothing until confirmed', async () => {
    term.feed('n');
    expect(await coach('file', '0.Inbox/Idea.md', '3.Resources/TS')).toBe(0);
    expect(term.text()).toContain(
      'move 0.Inbox/Idea.md → 3.Resources/TS/Idea.md',
    );
    expect(term.text()).toContain('Nothing changed.');
    expect(existsSync(join(root, 'vault', '0.Inbox', 'Idea.md'))).toBe(true);

    term.feed('y');
    expect(await coach('file', '0.Inbox/Idea.md', '3.Resources/TS')).toBe(0);
    expect(
      existsSync(join(root, 'vault', '3.Resources', 'TS', 'Idea.md')),
    ).toBe(true);
  });

  it('refuses to spar a note outside Resources', async () => {
    await mkdir(join(root, 'vault', '2.Areas', 'Health'), { recursive: true });
    await writeFile(
      join(root, 'vault', '2.Areas', 'Health', 'Sleep.md'),
      'Sleep.\n',
    );
    expect(await coach('spar', '2.Areas/Health/Sleep.md')).toBe(0);
    expect(term.text()).toContain(
      'only notes under 3.Resources can be sparred',
    );
  });

  it('reports usage errors and tool failures with an exit code', async () => {
    expect(await coach('nope')).toBe(2);
    expect(term.text()).toContain('Unknown command: nope');
    expect(await coach('--today', 'tomorrow')).toBe(2);
    expect(await coach('judge', 'no-such-session')).toBe(1);
    expect(term.text()).toContain(
      'no-such-session is not waiting for judgement',
    );
    expect(await coach('--help')).toBe(0);
  });
});

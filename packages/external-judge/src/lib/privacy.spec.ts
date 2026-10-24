import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  SparringSession,
  type ChatModel,
  type ChatRequest,
} from '@ai-coach/sparring-partner';
import { VaultClient } from '@ai-coach/vault-client';
import { ExternalJudge, sessionGaps } from './judge.js';

const SERVER_BIN =
  process.env['DOCS_MCP_BIN'] ??
  resolve(
    import.meta.dirname,
    '../../../../../kb-template/packages/cli/bin/docs-mcp.js',
  );

const SENTINEL = 'SENTINEL-7f3a9c-private-line-never-leaves-tier1';
const TITLE = 'Quixotic Kestrel Ledger';
const CONTAINER = 'Zanzibar-Topic';
const NOTE_PATH = `3.Resources/${CONTAINER}/${TITLE}.md`;
const NOTE_BODY = `# ${TITLE}\n\nMicrotasks drain before the next macrotask.\n\n${SENTINEL}\n`;

class LocalGemma implements ChatModel {
  readonly seen: string[] = [];
  private readonly replies: unknown[] = [
    { challenge: 'What decides which queued callback runs next, and why?' },
    {
      action: 'conclude',
      question: '',
      verdict: 'pass',
      gaps: [],
      feedback: 'Solid.',
    },
  ];

  async chat(request: ChatRequest): Promise<string> {
    this.seen.push(JSON.stringify(request));
    return JSON.stringify(this.replies.shift());
  }
}

const ARGON_REPLY = {
  items: [
    {
      claims: [
        {
          text: 'Promise callbacks run before timers.',
          kind: 'mechanism',
          supported: true,
          fallacies: [],
          handWave: false,
        },
      ],
      gaps: ['Does not explain what happens when a microtask queues another.'],
      verdict: 'fail',
      reason: 'Ordering stated, starvation not covered.',
    },
  ],
};

describe('privacy: nothing from the vault but the tier2 payload reaches Gemini', () => {
  const realFetch = globalThis.fetch;
  const savedEnv = { ...process.env };
  const outbound: { url: string; body: string; headers: string }[] = [];
  let root: string;
  let vault: VaultClient;

  beforeAll(async () => {
    if (!existsSync(SERVER_BIN)) {
      throw new Error(
        `Vault server not found at ${SERVER_BIN}; set DOCS_MCP_BIN`,
      );
    }
    root = await mkdtemp(join(tmpdir(), 'ai-coach-privacy-'));
    for (const folder of ['0.Inbox', '1.Projects', '2.Areas', '4.Archive']) {
      await mkdir(join(root, folder));
    }
    await mkdir(join(root, '3.Resources', CONTAINER), { recursive: true });
    await writeFile(join(root, NOTE_PATH), NOTE_BODY);
    vault = await VaultClient.connect({ serverBin: SERVER_BIN, vault: root });

    delete process.env['GOOGLE_API_KEY'];
    delete process.env['GOOGLE_GENAI_USE_VERTEXAI'];
    process.env['GEMINI_API_KEY'] = 'test-key-not-real';

    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const request = new Request(input, init);
      outbound.push({
        url: request.url,
        body: await request.clone().text(),
        headers: JSON.stringify([...request.headers.entries()]),
      });
      if (
        new URL(request.url).hostname !== 'generativelanguage.googleapis.com'
      ) {
        throw new TypeError(`unexpected host ${request.url}`);
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: JSON.stringify(ARGON_REPLY) }],
              },
              finishReason: 'STOP',
              index: 0,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;
  }, 30_000);

  afterAll(async () => {
    globalThis.fetch = realFetch;
    process.env = savedEnv;
    await vault?.close();
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('runs Tier 1 on the note, then sends Gemini only the challenge and answer', async () => {
    const note = await vault.readNote(NOTE_PATH);
    expect(note.body).toContain(SENTINEL);

    const gemma = new LocalGemma();
    const session = new SparringSession({
      model: gemma,
      note: { title: note.title, body: note.body },
    });
    const challenge = await session.start();
    expect(challenge.kind).toBe('challenge');
    await session.answer(
      'Promise callbacks are microtasks, so they run before any timer callback.',
    );
    const { challenge: asked, answer, verdict, gaps } = session.result();
    expect(gemma.seen.join('\n')).toContain(SENTINEL);

    const recorded = await vault.recordSession({
      tier: 1,
      items: [
        {
          note: NOTE_PATH,
          challenge: asked,
          answer,
          verdict,
          gaps,
          next_review: '2026-10-27',
        },
      ],
      execute: true,
    });
    const coachId = recorded.new_coach_ids[0]!.coach_id;

    const payload = await vault.tier2Payload(recorded.session_id);
    const report = await new ExternalJudge({ model: 'gemini-4-argon' }).judge(
      payload,
    );

    expect(outbound).toHaveLength(1);
    const sent = outbound[0]!;
    expect(new URL(sent.url).hostname).toBe(
      'generativelanguage.googleapis.com',
    );
    expect(sent.url).toContain('gemini-4-argon');
    expect(sent.body).toContain('What decides which queued callback runs next');
    expect(sent.body).toContain('Promise callbacks are microtasks');

    const everything = `${sent.url}\n${sent.headers}\n${sent.body}`;
    for (const secret of [
      SENTINEL,
      'SENTINEL',
      TITLE,
      CONTAINER,
      NOTE_PATH,
      'Microtasks drain before the next macrotask',
      coachId,
      recorded.session_id,
      root,
    ]) {
      expect(everything).not.toContain(secret);
    }

    const t2 = await vault.recordSession({
      tier: 2,
      items: [
        {
          coach_id: coachId,
          ...payload.items[0]!,
          verdict: report.items[0]!.verdict,
          gaps: sessionGaps(report.items[0]!),
          next_review: '2026-10-25',
        },
      ],
      execute: true,
    });
    expect(t2.items[0]).toMatchObject({ coach_id: coachId, verdict: 'fail' });
    expect((await vault.readNote(NOTE_PATH)).history.mastery).toBe(
      'tier1_passed',
    );
  });
});

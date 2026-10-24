import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { VaultClient, VaultToolError } from './vault-client.js';

const SERVER_BIN =
  process.env['DOCS_MCP_BIN'] ??
  resolve(
    import.meta.dirname,
    '../../../../../kb-template/packages/cli/bin/docs-mcp.js',
  );

const NOTES: Record<string, string> = {
  '3.Resources/TypeScript/Event loop.md':
    '# Event loop\n\nMicrotasks drain before the next macrotask.\n',
  '3.Resources/TypeScript/Promises.md':
    '---\ntags: [js]\n---\nA promise settles once. See [[Event loop]] and [missing](./Nope.md).\n',
  '3.Resources/Języki/Gramatyka.md': 'Odmiana przez przypadki: gęś, żółw.\n',
  '4.Archive/old/Ancient.md': 'Archived thought.\n',
  '1.Projects/Talk/Outline.md': 'Talk outline.\n',
};

async function makeVault(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'ai-coach-vault-'));
  for (const folder of [
    '0.Inbox',
    '1.Projects',
    '2.Areas',
    '3.Resources',
    '4.Archive',
  ]) {
    await mkdir(join(root, folder), { recursive: true });
  }
  for (const [path, body] of Object.entries(NOTES)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), body);
  }
  return root;
}

describe('VaultClient against the real vault server', () => {
  let root: string;
  let vault: VaultClient;

  beforeAll(async () => {
    if (!existsSync(SERVER_BIN)) {
      throw new Error(
        `Vault server not found at ${SERVER_BIN}. Build kb-template (pnpm run build) or set DOCS_MCP_BIN.`,
      );
    }
    root = await makeVault();
    vault = await VaultClient.connect({ serverBin: SERVER_BIN, vault: root });
  }, 30_000);

  afterAll(async () => {
    await vault?.close();
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('lists notes by PARA bucket', async () => {
    const all = await vault.listNotes();
    expect(all.total).toBe(5);
    expect(all.counts).toMatchObject({ resources: 3, archive: 1, projects: 1 });

    const resources = await vault.listNotes({ bucket: 'resources' });
    expect(resources.notes.map((n) => n.path).sort()).toEqual([
      '3.Resources/Języki/Gramatyka.md',
      '3.Resources/TypeScript/Event loop.md',
      '3.Resources/TypeScript/Promises.md',
    ]);
    expect(resources.notes.every((n) => n.mastery === 'unsparred')).toBe(true);
  });

  it('reads a note with frontmatter and resolved links', async () => {
    const note = await vault.readNote('3.Resources/TypeScript/Promises.md');
    expect(note.bucket).toBe('resources');
    expect(note.container).toBe('TypeScript');
    expect(note.frontmatter).toEqual({ tags: ['js'] });
    expect(note.body).toContain('A promise settles once.');
    expect(note.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'wikilink',
          resolved: '3.Resources/TypeScript/Event loop.md',
        }),
        expect.objectContaining({ kind: 'markdown', resolved: null }),
      ]),
    );
  });

  it('searches with diacritics folded', async () => {
    const hits = await vault.search({ query: 'ges', bucket: 'resources' });
    expect(hits[0]?.path).toBe('3.Resources/Języki/Gramatyka.md');
  });

  it('builds the link graph', async () => {
    const graph = await vault.vaultGraph({ bucket: 'resources' });
    expect(graph.edges).toContainEqual({
      source: '3.Resources/TypeScript/Promises.md',
      target: '3.Resources/TypeScript/Event loop.md',
      kind: 'wikilink',
    });
  });

  it('turns a tool failure into VaultToolError', async () => {
    await expect(vault.readNote('3.Resources/Nope.md')).rejects.toBeInstanceOf(
      VaultToolError,
    );
    await expect(
      vault.recordSession({
        tier: 1,
        items: [
          {
            note: '4.Archive/old/Ancient.md',
            challenge: 'c',
            answer: 'a',
            verdict: 'pass',
            next_review: '2026-11-01',
          },
        ],
        execute: true,
      }),
    ).rejects.toThrow(/record_session/);
  });

  it('runs a Tier 1 then Tier 2 session through to mastery and review dates', async () => {
    const item = {
      note: '3.Resources/TypeScript/Event loop.md',
      challenge:
        'Why does a resolved promise callback run before a setTimeout(0)?',
      answer: 'Because the microtask queue drains before the next task.',
      verdict: 'pass' as const,
      next_review: '2026-11-01',
    };

    const preview = await vault.recordSession({
      tier: 1,
      date: '2026-10-24',
      items: [item],
    });
    expect(preview.executed).toBe(false);
    expect(existsSync(join(root, 'Coach', 'sessions'))).toBe(false);

    const t1 = await vault.recordSession({
      tier: 1,
      date: '2026-10-24',
      items: [item],
      execute: true,
    });
    expect(t1.executed).toBe(true);
    expect(t1.new_coach_ids).toHaveLength(1);
    const coachId = t1.new_coach_ids[0]!.coach_id;
    expect(t1.items[0]).toMatchObject({ coach_id: coachId, verdict: 'pass' });
    expect(await readFile(join(root, item.note), 'utf8')).toContain(coachId);

    const payload = await vault.tier2Payload(t1.session_id);
    expect(payload).toEqual({
      items: [{ challenge: item.challenge, answer: item.answer }],
    });

    const t2 = await vault.recordSession({
      tier: 2,
      date: '2026-10-25',
      items: [
        {
          coach_id: coachId,
          challenge: item.challenge,
          answer: item.answer,
          verdict: 'pass',
          gaps: [],
          next_review: '2026-11-08',
        },
      ],
      execute: true,
    });
    expect(t2.new_coach_ids).toEqual([]);

    const note = await vault.readNote(item.note);
    expect(note.coachId).toBe(coachId);
    expect(note.history).toMatchObject({
      mastery: 'tier2_passed',
      nextReview: '2026-11-08',
      sessions: 2,
    });
    expect(await readdir(join(root, 'Coach', 'sessions'))).toHaveLength(2);

    const before = await vault.dueForReview({ today: '2026-11-07' });
    expect(before.due).toEqual([]);
    expect(before.unsparred.map((n) => n.path)).not.toContain(item.note);

    const after = await vault.dueForReview({ today: '2026-11-08' });
    expect(after.due).toEqual([
      expect.objectContaining({
        coachId,
        nextReview: '2026-11-08',
        mastery: 'tier2_passed',
      }),
    ]);
  });

  it('rejects an unknown session id for the Tier 2 payload', async () => {
    await expect(vault.tier2Payload('no-such-session')).rejects.toThrow(
      /Session not found/,
    );
  });

  it('previews filing moves and only applies them on execute', async () => {
    const captured = await vault.capture({
      title: 'Idea',
      body: 'Raw thought.',
    });
    expect(captured.executed).toBe(false);
    expect(existsSync(join(root, '0.Inbox', 'Idea.md'))).toBe(false);

    await vault.capture({ title: 'Idea', body: 'Raw thought.', execute: true });
    expect(existsSync(join(root, '0.Inbox', 'Idea.md'))).toBe(true);

    const move = { path: '0.Inbox/Idea.md', to: '3.Resources/TypeScript' };
    const preview = await vault.fileNote(move);
    expect(preview).toMatchObject({
      executed: false,
      collisions: [],
      errors: [],
    });
    expect(preview.actions).toContainEqual({
      op: 'move',
      from: '0.Inbox/Idea.md',
      to: '3.Resources/TypeScript/Idea.md',
    });

    const done = await vault.fileNote({ ...move, execute: true });
    expect(done.executed).toBe(true);
    expect(existsSync(join(root, '3.Resources', 'TypeScript', 'Idea.md'))).toBe(
      true,
    );
  });

  it('archives a project folder', async () => {
    const done = await vault.archiveProject({ project: 'Talk', execute: true });
    expect(done.executed).toBe(true);
    expect(existsSync(join(root, '4.Archive', 'Talk', 'Outline.md'))).toBe(
      true,
    );
  });
});

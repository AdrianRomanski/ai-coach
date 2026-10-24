import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FilePendingJudgements,
  SystemClock,
  localDate,
} from './local-state.js';

describe('FilePendingJudgements', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ai-coach-state-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('keeps sessions in order, replaces by id and removes', async () => {
    const queue = new FilePendingJudgements(join(dir, 'nested'));
    expect(await queue.list()).toEqual([]);
    await queue.add({
      sessionId: 's1',
      date: '2026-10-24',
      coachIds: ['c1', 'c2'],
    });
    await queue.add({ sessionId: 's2', date: '2026-10-24', coachIds: ['c3'] });
    await queue.add({ sessionId: 's1', date: '2026-10-25', coachIds: ['c1'] });
    expect((await queue.list()).map((s) => [s.sessionId, s.date])).toEqual([
      ['s2', '2026-10-24'],
      ['s1', '2026-10-25'],
    ]);
    await queue.remove('s2');
    expect(
      JSON.parse(await readFile(queue.file, 'utf8')).sessions,
    ).toHaveLength(1);
  });

  it('refuses a corrupt file instead of losing the queue', async () => {
    const queue = new FilePendingJudgements(dir);
    await writeFile(
      queue.file,
      JSON.stringify({ sessions: [{ sessionId: 's' }] }),
    );
    await expect(queue.list()).rejects.toThrow(/corrupt/);
  });
});

describe('SystemClock', () => {
  it('uses the local date unless pinned', () => {
    expect(new SystemClock().today()).toBe(localDate());
    expect(new SystemClock('2026-10-24').today()).toBe('2026-10-24');
    expect(localDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

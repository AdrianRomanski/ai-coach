import {
  DEFAULT_LADDER,
  sparringRules,
  type ItemJudgement,
} from '@ai-coach/domain';
import {
  InMemoryPending,
  InMemoryVault,
  ScriptedJudge,
  ScriptedPartner,
} from '../testing/in-memory.js';
import {
  NotFoundError,
  NotSparrableError,
  PayloadMismatchError,
} from './errors.js';
import { Judging } from './judging/judging.js';
import { Review } from './review/review.js';
import { Sparring, type SparredNote } from './sparring/sparring.js';

const EVENT_LOOP = '3.Resources/TS/Event loop.md';
const PROMISES = '3.Resources/TS/Promises.md';
const PRIVATE = 'PRIVATE-LINE-never-leaves';

const judgement = (
  verdict: 'pass' | 'fail',
  gaps: string[] = [],
): ItemJudgement => ({
  claims: [
    {
      text: 'Microtasks first.',
      kind: 'mechanism',
      supported: true,
      fallacies: [],
      handWave: false,
    },
  ],
  gaps,
  verdict,
  reason: 'r',
});

function setup() {
  const vault = new InMemoryVault({
    [EVENT_LOOP]: `Microtasks drain first.\n${PRIVATE}\n`,
    [PROMISES]: 'A promise settles once.\n',
    '2.Areas/Health/Sleep.md': 'Sleep.\n',
  });
  const pending = new InMemoryPending();
  const partner = new ScriptedPartner();
  const judge = new ScriptedJudge();
  const ladder = DEFAULT_LADDER;
  return {
    vault,
    pending,
    partner,
    judge,
    sparring: new Sparring({
      notes: vault,
      sessions: vault,
      pending,
      partner,
      rules: sparringRules(),
      ladder,
    }),
    judging: new Judging({
      notes: vault,
      sessions: vault,
      pending,
      judge,
      ladder,
    }),
    review: new Review(vault, pending),
  };
}

async function sparOnce(
  s: ReturnType<typeof setup>,
  path: string,
  verdict: 'pass' | 'fail',
  today: string,
) {
  s.partner.challenges.push(`What is the core idea of ${path.length}?`);
  s.partner.turns.push({ action: 'conclude', verdict, gaps: [], feedback: '' });
  const { note, conversation } = await s.sparring.open(path);
  await conversation.start();
  await conversation.answer('My own explanation of the mechanism.');
  const sparred: SparredNote[] = [{ note, result: conversation.result() }];
  return s.sparring.record(await s.sparring.plan(sparred, today));
}

describe('books split into chapters', () => {
  const BOOK = '3.Resources/0.Raw/Books/Tiago Forte/Building a Second Brain';
  const INDEX = `${BOOK}/text.md`;
  const CHAPTER = `${BOOK}/chapters/02 Capture.md`;

  function withBook() {
    const s = setup();
    s.vault.put(INDEX, 'The text is in the chapter notes.', {
      rawRole: 'index',
    });
    s.vault.put(CHAPTER, 'Keep what resonates.', {
      rawRole: 'chapter',
      chapter: {
        book: 'Building a Second Brain',
        part: 'Part One',
        chapter: 2,
        section: null,
        pages: '40-58',
      },
    });
    return s;
  }

  it('offers chapters, never the index, and spars a chapter like any note', async () => {
    const s = withBook();
    const offered = (await s.sparring.candidates('2026-10-24')).map(
      (c) => c.path,
    );
    expect(offered).toContain(CHAPTER);
    expect(offered).not.toContain(INDEX);

    const { note } = await s.sparring.open(CHAPTER);
    expect(note.chapter).toMatchObject({
      book: 'Building a Second Brain',
      pages: '40-58',
    });
  });

  it('refuses the index before any dialogue starts', async () => {
    const s = withBook();
    await expect(s.sparring.open(INDEX)).rejects.toThrow(
      /book's index: spar one of its chapters/,
    );
    expect(s.partner.challengeRequests).toEqual([]);
  });
});

describe('coaching use cases against in-memory adapters', () => {
  it('offers due and never-sparred Resources notes, and resolves coach_ids', async () => {
    const s = setup();
    expect(
      (await s.sparring.candidates('2026-10-24')).map((c) => c.reason),
    ).toEqual(['never sparred', 'never sparred']);
    const recorded = await sparOnce(s, EVENT_LOOP, 'pass', '2026-10-24');
    expect(
      await s.sparring.resolve([recorded.items[0]!.coachId, PROMISES]),
    ).toEqual([EVENT_LOOP, PROMISES]);
    await expect(s.sparring.resolve(['c-unknown'])).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      s.sparring.open('2.Areas/Health/Sleep.md'),
    ).rejects.toBeInstanceOf(NotSparrableError);
  });

  it('records Tier 1 with a 3-day review and queues it for the judge', async () => {
    const s = setup();
    const recorded = await sparOnce(s, EVENT_LOOP, 'pass', '2026-10-24');
    expect(recorded.items[0]).toMatchObject({
      verdict: 'pass',
      nextReview: '2026-10-27',
    });
    expect(s.pending.sessions).toEqual([
      {
        sessionId: recorded.sessionId,
        date: '2026-10-24',
        coachIds: [recorded.items[0]!.coachId],
      },
    ]);
    expect((await s.review.due('2026-10-24')).waitingForJudge).toBe(1);
  });

  it('judges only the payload, enforces the verdict rule, schedules from history and clears the queue', async () => {
    const s = setup();
    await sparOnce(s, EVENT_LOOP, 'pass', '2026-10-24');
    s.judge.reports.push({ model: 'argon', items: [judgement('pass')] });

    const [session] = await s.judging.select([]);
    const judged = await s.judging.judge(session!, '2026-10-24');
    expect(JSON.stringify(s.judge.payloads)).not.toContain(PRIVATE);
    expect(s.judge.payloads[0]!.items[0]).toEqual({
      challenge: expect.any(String),
      answer: 'My own explanation of the mechanism.',
    });
    expect(judged.notes[0]).toMatchObject({
      title: 'Event loop',
      nextReview: '2026-10-31',
    });

    await s.judging.record(judged);
    expect(s.pending.sessions).toEqual([]);
    expect((await s.vault.readNote(EVENT_LOOP)).mastery).toBe('tier2_passed');

    await sparOnce(s, EVENT_LOOP, 'pass', '2026-10-31');
    s.judge.reports.push({ model: 'argon', items: [judgement('pass')] });
    const second = await s.judging.judge(
      (await s.judging.select([]))[0]!,
      '2026-10-31',
    );
    expect(second.notes[0]!.nextReview).toBe('2026-11-14');
  });

  it('fails a model pass that leaves gaps and drops the ladder', async () => {
    const s = setup();
    await sparOnce(s, EVENT_LOOP, 'pass', '2026-10-24');
    s.judge.reports.push({
      model: 'argon',
      items: [judgement('pass', ['Skips the task queue.'])],
    });
    const judged = await s.judging.judge(
      (await s.judging.select([]))[0]!,
      '2026-10-24',
    );
    expect(judged.notes[0]!.judgement).toMatchObject({
      modelVerdict: 'pass',
      verdict: 'fail',
    });
    expect(judged.notes[0]!.nextReview).toBe('2026-10-25');
  });

  it('skips notes that disappeared and refuses a mismatched judge reply', async () => {
    const s = setup();
    const recorded = await sparOnce(s, EVENT_LOOP, 'pass', '2026-10-24');
    s.vault.notes.delete(EVENT_LOOP);
    s.judge.reports.push({ model: 'argon', items: [judgement('pass')] });
    const judged = await s.judging.judge(
      (await s.judging.select([]))[0]!,
      '2026-10-24',
    );
    expect(judged).toMatchObject({
      missing: [recorded.items[0]!.coachId],
      draft: null,
      preview: null,
    });
    expect(await s.judging.record(judged)).toBeNull();

    const t = setup();
    await sparOnce(t, EVENT_LOOP, 'pass', '2026-10-24');
    t.judge.reports.push({ model: 'argon', items: [] });
    await expect(
      t.judging.judge((await t.judging.select([]))[0]!, '2026-10-24'),
    ).rejects.toBeInstanceOf(PayloadMismatchError);
    await expect(t.judging.select(['nope'])).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

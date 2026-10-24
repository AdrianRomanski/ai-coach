import { sparringRules } from '@ai-coach/domain';
import {
  FixedClassifier,
  InMemoryVault,
  ScriptedStudyPartner,
} from '../../testing/in-memory.js';
import { NotFoundError, NotSparrableError } from '../errors.js';
import { Studying } from './studying.js';

const CHAPTER = '3.Resources/Book/chapters/05 Distill.md';
const BODY = [
  '# Distill',
  '## Page 40',
  'Capture means keeping only what resonates with you, the ideas that surprise or move you.',
  '## Page 41',
  'Distill by highlighting and bolding the most important passages so that future you',
  'can find the essence of a note quickly, without rereading everything.',
].join('\n');

async function setup(
  verdict: 'pass' | 'fail' = 'fail',
  gaps = [
    'You did not explain why bolding passages helps future you.',
    'You did not say what capture keeps.',
  ],
) {
  const vault = new InMemoryVault({ [CHAPTER]: BODY });
  await vault.record(
    {
      tier: 1,
      date: '2026-10-24',
      items: [
        {
          note: { path: CHAPTER },
          challenge: 'C?',
          answer: 'A.',
          verdict,
          gaps,
          nextReview: '2026-10-25',
        },
      ],
    },
    true,
  );
  const partner = new ScriptedStudyPartner();
  return {
    vault,
    partner,
    studying: new Studying({
      notes: vault,
      partner,
      classifier: new FixedClassifier(),
      rules: sparringRules(),
    }),
  };
}

describe('Studying', () => {
  it('walks each gap with a hint, the author passage on a miss, and a limit of two tries', async () => {
    const { studying, partner, vault } = await setup();
    partner.hints.push(
      'What does future you need from a note?',
      'Which ideas are worth keeping?',
    );
    partner.quotes.push(
      'highlighting and bolding the most important passages future you',
    );
    partner.checks.push(
      { closed: false, nudge: 'Say what bolding saves you.' },
      { closed: true, nudge: '' },
      { closed: false, nudge: 'Name what decides it.' },
      { closed: false, nudge: 'Still missing the criterion.' },
    );

    const { note, session } = await studying.open(CHAPTER);
    expect(await session.start()).toEqual({
      gap: 'You did not explain why bolding passages helps future you.',
      index: 0,
      total: 2,
      hint: 'What does future you need from a note?',
      place: { kind: 'here' },
    });

    expect(await session.answer('It just works.')).toEqual({
      kind: 'rephrase',
      buzzwords: ['just works'],
    });
    expect(partner.checked).toEqual([]);

    expect(await session.answer('It marks things.')).toEqual({
      kind: 'retry',
      nudge: 'Say what bolding saves you.',
      passage: {
        text: 'Distill by highlighting and bolding the most important passages so that future you can find the essence of a note quickly, without rereading everything.',
        page: 41,
      },
    });
    expect(
      await session.answer(
        'Bolding lets future me find the essence without rereading.',
      ),
    ).toMatchObject({
      kind: 'closed',
      next: { index: 1, hint: 'Which ideas are worth keeping?' },
    });

    expect((await session.answer('Everything.')).kind).toBe('retry');
    expect(await session.answer('Anything.')).toEqual({
      kind: 'unresolved',
      nudge: 'Still missing the criterion.',
      next: null,
    });
    expect(session.isFinished).toBe(true);

    expect(studying.explanationsNote(note, session, '2026-10-24')).toEqual({
      kind: 'capture',
      title: '05 Distill - in my words',
      body:
        'Studied on 2026-10-24 from [[3.Resources/Book/chapters/05 Distill|05 Distill]].\n\n' +
        '## You did not explain why bolding passages helps future you.\n\nBolding lets future me find the essence without rereading.\n\n' +
        '## You did not say what capture keeps.\n\nAnything.\n\n_Still open: reread the source and try again._\n',
    });
    expect(vault.sessions).toHaveLength(1);
  });

  it('sends a gap this chapter does not cover to the chapter of the same book that does', async () => {
    const book = '3.Resources/0.Raw/Books/A/B/chapters/';
    const intro = `${book}01 Intro.md`;
    const vault = new InMemoryVault();
    const chapter = (n: number) => ({
      book: 'B',
      part: null,
      chapter: n,
      section: null,
      pages: '1-2',
    });
    vault.put(intro, '## Page 5\nWelcome to the book about notes.', {
      rawRole: 'chapter',
      chapter: chapter(1),
    });
    vault.put(`${book}06 Distill.md`, BODY, {
      rawRole: 'chapter',
      chapter: chapter(6),
    });
    vault.put('3.Resources/Other/Unrelated.md', BODY);
    await vault.record(
      {
        tier: 1,
        date: '2026-10-24',
        items: [
          {
            note: { path: intro },
            challenge: 'C?',
            answer: 'A.',
            verdict: 'fail',
            gaps: [
              'You did not explain why highlighting and bolding help future you find the essence.',
              'You did not explain quantum lattices.',
            ],
            nextReview: '2026-10-25',
          },
        ],
      },
      true,
    );
    const partner = new ScriptedStudyPartner();
    partner.choices.push(0, null);
    partner.checks.push({ closed: true, nudge: '' });
    const studying = new Studying({
      notes: vault,
      partner,
      classifier: new FixedClassifier(),
      rules: sparringRules(),
    });

    const { session } = await studying.open(intro);
    const first = await session.start();
    expect(first!.place).toEqual({
      kind: 'elsewhere',
      chapter: '06 Distill',
      passage: expect.objectContaining({ page: 41 }),
    });
    expect(partner.hintedFrom).toEqual(['06 Distill']);
    expect(partner.offered[0]).toEqual([
      expect.stringMatching(/^06 Distill: Distill by highlighting/),
    ]);

    const next = await session.answer(
      'Bolding lets future me find the essence fast.',
    );
    expect(next).toMatchObject({
      kind: 'closed',
      next: { place: { kind: 'outside' } },
    });
    expect(partner.hintedFrom).toEqual(['06 Distill', '01 Intro']);
  });

  it('answers a request for help with a clue and the passage, without using an attempt', async () => {
    const { studying, partner } = await setup();
    partner.quotes.push(
      'highlighting and bolding the most important passages so that future',
    );
    partner.checks.push({ closed: false, nudge: 'Not yet.' });
    const { session } = await studying.open(CHAPTER, 'cornell');
    await session.start();

    expect(await session.answer('what do you mean - teach me')).toEqual({
      kind: 'help',
      clue: 'Clue for You did not explain why bolding passages helps future you.',
      passage: expect.objectContaining({ page: 41 }),
    });
    expect(partner.checked).toEqual([]);
    expect(partner.styles).toEqual(['cornell']);
    expect((await session.answer('It looks nice.')).kind).toBe('retry');
  });

  it('keeps going when the partner gives an unusable hint, clue or check', async () => {
    const { studying, partner } = await setup();
    partner.failing.add('hint').add('clue').add('check');
    const { session } = await studying.open(CHAPTER);
    expect((await session.start())!.hint).toBe(
      'How would you explain this point in your own words?',
    );
    expect(await session.answer('teach me')).toMatchObject({
      kind: 'help',
      clue: expect.stringMatching(/^Reread the passage/),
    });
    expect(await session.answer('Bolding helps.')).toMatchObject({
      kind: 'retry',
      nudge: expect.stringMatching(/could not judge/),
    });
  });

  it('studies only a latest session that failed with gaps, and never a book index', async () => {
    const passed = await setup('pass', []);
    await expect(passed.studying.open(CHAPTER)).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const fresh = new Studying({
      notes: new InMemoryVault({ [CHAPTER]: BODY }),
      partner: new ScriptedStudyPartner(),
      classifier: new FixedClassifier(),
      rules: sparringRules(),
    });
    await expect(fresh.open(CHAPTER)).rejects.toThrow(/no gaps to study/);

    const vault = new InMemoryVault();
    vault.put('3.Resources/Book/text.md', 'Index.', { rawRole: 'index' });
    const studying = new Studying({
      notes: vault,
      partner: new ScriptedStudyPartner(),
      classifier: new FixedClassifier(),
      rules: sparringRules(),
    });
    await expect(
      studying.open('3.Resources/Book/text.md'),
    ).rejects.toBeInstanceOf(NotSparrableError);
  });
});

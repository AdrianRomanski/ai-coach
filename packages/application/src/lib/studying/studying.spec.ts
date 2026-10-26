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

  it('studies a concept note against its assertions, with its own verified quotes', async () => {
    const concept = '3.Resources/Concepts/Progressive Summarization.md';
    const vault = new InMemoryVault();
    vault.put(
      concept,
      'My summary: layers make a note faster to grasp later.',
      {
        rawRole: null,
        concept: {
          assertions: [
            'Each layer of highlights is smaller, so future you can grasp a note in seconds.',
          ],
          buzzwords: ['progressive summarization'],
          passages: [
            {
              quote: 'Capture means keeping only what resonates with you.',
              note: 'raw/a.md',
              pages: '40',
              found: true,
            },
            {
              quote:
                'Distill by bolding and highlighting the best passages so future you finds the essence.',
              note: 'raw/a.md',
              pages: '98-99',
              found: true,
            },
            {
              quote: 'A quote the book no longer contains.',
              note: 'raw/a.md',
              pages: '7',
              found: false,
            },
          ],
          problems: [],
        },
      },
    );
    await vault.record(
      {
        tier: 1,
        date: '2026-10-24',
        items: [
          {
            note: { path: concept },
            challenge: 'C?',
            answer: 'A.',
            verdict: 'fail',
            gaps: [
              'You did not explain why bolding and highlighting help future you.',
              'You did not explain quantum lattices.',
            ],
            nextReview: '2026-10-25',
          },
        ],
      },
      true,
    );
    const partner = new ScriptedStudyPartner();
    partner.checks.push({ closed: false, nudge: 'Not yet.' });
    const studying = new Studying({
      notes: vault,
      partner,
      classifier: new FixedClassifier(),
      rules: sparringRules(),
    });

    const { session } = await studying.open(concept);
    expect((await session.start())!.place).toEqual({ kind: 'here' });
    expect(await session.answer('It looks nice.')).toEqual({
      kind: 'retry',
      nudge: 'Not yet.',
      passage: {
        text: 'Distill by bolding and highlighting the best passages so future you finds the essence.',
        page: 98,
      },
    });
    expect(partner.requests.at(-1)).toMatchObject({
      assertions: [
        'Each layer of highlights is smaller, so future you can grasp a note in seconds.',
      ],
    });
    await session.skip();
    expect(session.gaps.at(-1)!.status).toBe('open');
  });

  it('never shows the same quote twice, and looks in the source chapter when no quote fits', async () => {
    const concept = '3.Resources/Concepts/Layers.md';
    const vault = new InMemoryVault({
      'raw/ch6.md': [
        '## Page 100',
        'Each of these layers uses a different kind of formatting so you can easily tell them apart.',
        '## Page 101',
        'Bold the main points first, and later highlight only the best of what you bolded.',
      ].join('\n'),
    });
    vault.put(concept, 'Bold, then highlight, then summarize.', {
      rawRole: null,
      concept: {
        assertions: ['Bolding comes before highlighting.'],
        buzzwords: [],
        passages: [
          {
            quote: 'main points of a note',
            note: 'raw/ch6.md',
            pages: '100',
            found: true,
          },
          {
            quote:
              'you highlight the main points of a note, and then highlight the main points of those highlights',
            note: 'raw/ch6.md',
            pages: '100',
            found: true,
          },
        ],
        problems: [],
      },
    });
    await vault.record(
      {
        tier: 1,
        date: '2026-10-25',
        items: [
          {
            note: { path: concept },
            challenge: 'C?',
            answer: 'A.',
            verdict: 'fail',
            gaps: [
              'You did not explain why you highlight the main points of those highlights.',
              'You did not explain why different formatting makes the layers easy to tell apart.',
            ],
            nextReview: '2026-10-26',
          },
        ],
      },
      true,
    );
    const partner = new ScriptedStudyPartner();
    partner.checks.push(
      { closed: false, nudge: 'Why?' },
      { closed: false, nudge: 'Still why?' },
      { closed: false, nudge: 'Formatting?' },
    );
    const { session } = await new Studying({
      notes: vault,
      partner,
      classifier: new FixedClassifier(),
      rules: sparringRules(),
    }).open(concept);
    await session.start();

    const first = await session.answer('It is the essence.');
    expect(first).toMatchObject({
      kind: 'retry',
      passage: {
        text: 'you highlight the main points of a note, and then highlight the main points of those highlights',
        page: 100,
      },
    });
    expect(await session.answer('It is the core.')).toMatchObject({
      kind: 'unresolved',
    });
    expect(await session.answer('It looks different.')).toMatchObject({
      kind: 'retry',
      passage: {
        text: 'Each of these layers uses a different kind of formatting so you can easily tell them apart.',
        page: 100,
      },
    });
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

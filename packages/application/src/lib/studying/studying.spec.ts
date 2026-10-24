import { sparringRules } from '@ai-coach/domain';
import {
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
    'You did not explain why bolding helps.',
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
    studying: new Studying({ notes: vault, partner, rules: sparringRules() }),
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
      gap: 'You did not explain why bolding helps.',
      index: 0,
      total: 2,
      hint: 'What does future you need from a note?',
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
        '## You did not explain why bolding helps.\n\nBolding lets future me find the essence without rereading.\n\n' +
        '## You did not say what capture keeps.\n\nAnything.\n\n_Still open: reread the source and try again._\n',
    });
    expect(vault.sessions).toHaveLength(1);
  });

  it('studies only a latest session that failed with gaps, and never a book index', async () => {
    const passed = await setup('pass', []);
    await expect(passed.studying.open(CHAPTER)).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const fresh = new Studying({
      notes: new InMemoryVault({ [CHAPTER]: BODY }),
      partner: new ScriptedStudyPartner(),
      rules: sparringRules(),
    });
    await expect(fresh.open(CHAPTER)).rejects.toThrow(/no gaps to study/);

    const vault = new InMemoryVault();
    vault.put('3.Resources/Book/text.md', 'Index.', { rawRole: 'index' });
    const studying = new Studying({
      notes: vault,
      partner: new ScriptedStudyPartner(),
      rules: sparringRules(),
    });
    await expect(
      studying.open('3.Resources/Book/text.md'),
    ).rejects.toBeInstanceOf(NotSparrableError);
  });
});

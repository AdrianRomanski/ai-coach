import { DomainError, sparringRules } from '@ai-coach/domain';
import type { BookProgress } from '../ports/library.js';
import {
  InMemoryLibrary,
  InMemoryVault,
  ScriptedDistillPartner,
  unusable,
} from '../../testing/in-memory.js';
import { NotFoundError, VaultRefusedError } from '../errors.js';
import { Distilling } from './distilling.js';

const FOLDER = '3.Resources/0.Raw/Books/Tiago Forte/Building a Second Brain';
const CH5 = `${FOLDER}/chapters/05 Distill.md`;
const CH6 = `${FOLDER}/chapters/06 Express.md`;
const CH7 = `${FOLDER}/chapters/07 Untouched.md`;
const READING = '0.Inbox/Second Brain reading.md';

const BOOK: BookProgress = {
  index: `${FOLDER}/text.md`,
  folder: FOLDER,
  title: 'Building a Second Brain',
  author: 'Tiago Forte',
  stage: 'distilling',
  notes: [READING],
  chapters: [
    { path: CH5, title: 'Distill', summary: true, state: 'complete' },
    { path: CH6, title: 'Express', summary: false, state: 'in_progress' },
    { path: CH7, title: 'Untouched', summary: false, state: 'untouched' },
  ],
};

function setup() {
  const vault = new InMemoryVault();
  vault.put(
    CH5,
    [
      '> [!summary]',
      '> Layers make a note quick to grasp later.',
      '',
      '## Page 98',
      'Notes need **discoverability for the future** above all.',
      'Then ==highlight the best of what is bolded== on a later pass.',
    ].join('\n'),
    { rawRole: 'chapter' },
  );
  vault.put(
    CH6,
    '## Page 120\nShare **intermediate packets** with others early.',
    { rawRole: 'chapter' },
  );
  vault.put(CH7, '## Page 140\n**Never read.**', { rawRole: 'chapter' });
  vault.put(READING, 'Express means   sharing small pieces\nearly.');
  const library = new InMemoryLibrary(
    vault,
    [BOOK],
    [
      {
        note: CH6,
        title: 'Express',
        page: 120,
        snippet: '… Share intermediate packets with others early. Then …',
      },
    ],
  );
  const partner = new ScriptedDistillPartner();
  const distilling = new Distilling({
    notes: vault,
    library,
    partner,
    rules: sparringRules(),
  });
  return { vault, library, partner, distilling };
}

describe('Distilling', () => {
  it('finds a book by folder, index or title and names the known books otherwise', async () => {
    const { distilling } = setup();
    await expect(distilling.book(`${FOLDER}/`)).resolves.toBe(BOOK);
    await expect(distilling.book('building a second brain')).resolves.toBe(
      BOOK,
    );
    await expect(distilling.book('Atomic Habits')).rejects.toThrow(
      new NotFoundError(
        'No converted book matches "Atomic Habits"; known books: Building a Second Brain',
      ),
    );
  });

  it('gathers marks from touched chapters and the reading notes, numbered', async () => {
    const { distilling } = setup();
    const material = await distilling.gather(BOOK);
    expect(material.map((m) => [m.id, m.kind, m.text, m.page])).toEqual([
      [1, 'summary', 'Layers make a note quick to grasp later.', null],
      [2, 'highlight', 'highlight the best of what is bolded', 98],
      [3, 'bold', 'discoverability for the future', 98],
      [4, 'bold', 'intermediate packets', 120],
      [5, 'note', 'Express means sharing small pieces early.', null],
    ]);
    expect(material[4]!.note).toBe(READING);
  });

  it('keeps proposed ideas that point at known material and falls back to chapters', async () => {
    const { distilling, partner } = setup();
    const material = await distilling.gather(BOOK);
    partner.ideas = [
      { title: ' Layers ', items: [2, 3, 3, 99] },
      { title: 'Nothing real', items: [42] },
      { title: '', items: [1] },
    ];
    const ideas = await distilling.ideas(material);
    expect(ideas.map((i) => [i.title, i.items.map((m) => m.id)])).toEqual([
      ['Layers', [2, 3]],
    ]);

    partner.ideas = unusable();
    const fallback = await distilling.ideas(material);
    expect(fallback.map((i) => [i.title, i.items.map((m) => m.id)])).toEqual([
      ['Distill', [1, 2, 3]],
      ['Express', [4]],
      ['Second Brain reading', [5]],
    ]);
  });

  it('asks at most two gap questions and drafts at most six assertions, empty on an unusable reply', async () => {
    const { distilling, partner } = setup();
    const idea = (await distilling.ideas(await distilling.gather(BOOK)))[0]!;
    partner.questions = ['Why bold first?', ' ', 'What then?', 'And then?'];
    await expect(distilling.questions(idea, 'My summary.')).resolves.toEqual([
      'Why bold first?',
      'What then?',
    ]);
    partner.questions = unusable();
    await expect(distilling.questions(idea, 'My summary.')).resolves.toEqual(
      [],
    );

    partner.assertions = Array.from({ length: 8 }, (_, i) => `Claim ${i}.`);
    const answers = [{ question: 'Why bold first?', answer: 'To skim.' }];
    await expect(
      distilling.assertions(idea, 'My summary.', answers),
    ).resolves.toHaveLength(6);
    expect(partner.seen.at(-1)).toEqual({ summary: 'My summary.', answers });

    partner.buzzwords = ['layers', 'layers', ' distill ', ''];
    await expect(distilling.buzzwords(idea)).resolves.toEqual([
      'layers',
      'distill',
    ]);
  });

  it('quotes marked passages, and searches the book for an idea that only has notes', async () => {
    const { distilling, library } = setup();
    const material = await distilling.gather(BOOK);
    await expect(
      distilling.passages(
        { title: 'Layers', items: material.slice(0, 3) },
        BOOK,
      ),
    ).resolves.toEqual([
      { note: CH5, quote: 'highlight the best of what is bolded', pages: '98' },
      { note: CH5, quote: 'discoverability for the future', pages: '98' },
    ]);

    await expect(
      distilling.passages({ title: 'Express', items: [material[4]!] }, BOOK),
    ).resolves.toEqual([
      {
        note: CH6,
        quote: 'Share intermediate packets with others early.',
        pages: '120',
      },
    ]);
    expect(library.searches).toEqual([
      { query: 'Express means sharing small pieces early.', within: FOLDER },
    ]);
  });

  it('previews without writing, then creates the concept', async () => {
    const { distilling, library, vault } = setup();
    const draft = {
      title: 'Progressive Summarization',
      summary: 'Layers make a note quick to grasp later.',
      assertions: ['Each layer is smaller than the one before.'],
      buzzwords: [],
      passages: [
        {
          note: CH5,
          quote: 'highlight the best of what is bolded',
          pages: '98',
        },
      ],
      fromNotes: [READING],
    };
    const preview = await distilling.preview(draft);
    expect(preview).toMatchObject({
      path: '3.Resources/Concepts/Progressive Summarization.md',
      executed: false,
    });
    expect(preview.passages[0]).toMatchObject({ found: true });
    expect(library.created).toEqual([]);

    await expect(distilling.create(draft)).resolves.toMatchObject({
      executed: true,
    });
    expect(
      vault.notes.get('3.Resources/Concepts/Progressive Summarization.md')
        ?.concept?.assertions,
    ).toEqual(['Each layer is smaller than the one before.']);
  });

  it('refuses an invalid draft before calling the vault, and passes on a vault refusal', async () => {
    const { distilling, library } = setup();
    const draft = {
      title: 'X',
      summary: 'S.',
      assertions: [],
      buzzwords: [],
      passages: [{ note: CH5, quote: 'not in the chapter at all' }],
      fromNotes: [],
    };
    await expect(distilling.preview(draft)).rejects.toThrow(DomainError);
    await expect(
      distilling.preview({ ...draft, assertions: ['A claim.'] }),
    ).rejects.toThrow(VaultRefusedError);
    expect(library.created).toEqual([]);
  });
});

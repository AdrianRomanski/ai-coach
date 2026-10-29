import { stripVTControlCharacters } from 'node:util';
import type { BookProgress, Synthesizing, Idea } from '@ai-coach/application';
import { conceptDraft, type ConceptDraft } from '@ai-coach/domain';
import type { Coach } from './composition.js';
import { synthesize } from './synthesize.js';
import type { Terminal } from './terminal.js';

class ScriptedTerminal implements Terminal {
  readonly output: string[] = [];
  constructor(private readonly inputs: string[]) {}
  print(text = ''): void {
    this.output.push(text);
  }
  async ask(prompt: string): Promise<string | null> {
    this.output.push(prompt);
    return this.inputs.length ? this.inputs.shift()! : null;
  }
  text(): string {
    return stripVTControlCharacters(this.output.join('\n'));
  }
}

const CH5 = 'raw/Book/chapters/05 Distill.md';
const BOOK: BookProgress = {
  index: 'raw/Book/text.md',
  folder: 'raw/Book',
  title: 'Building a Second Brain',
  author: null,
  stage: 'distilling',
  notes: ['0.Inbox/Reading.md'],
  chapters: [{ path: CH5, title: 'Distill', summary: true, state: 'complete' }],
};
const IDEA: Idea = {
  title: 'Layers',
  items: [
    {
      id: 1,
      kind: 'highlight',
      text: 'highlight the best of what is bolded',
      note: CH5,
      chapter: 'Distill',
      page: 98,
    },
    {
      id: 2,
      kind: 'note',
      text: 'Layers save time.',
      note: '0.Inbox/Reading.md',
      chapter: 'Reading',
      page: null,
    },
  ],
};

function coachWith(created: ConceptDraft[], asked: string[][]): Coach {
  const synthesizing = {
    books: async () => [BOOK],
    book: async () => BOOK,
    gather: async () => IDEA.items,
    ideas: async () => [IDEA],
    questions: async (_idea: Idea, summary: string) => {
      asked.push([summary]);
      return ['Why bold before you highlight?'];
    },
    assertions: async () => [
      'Each layer is smaller than the one before.',
      'Layers are a fad.',
      'Bold first.',
    ],
    buzzwords: async () => ['progressive summarization'],
    passages: async () => [
      { note: CH5, quote: 'highlight the best of what is bolded', pages: '98' },
    ],
    draft: conceptDraft,
    preview: async (draft: ConceptDraft) => ({
      path: `3.Resources/Concepts/${draft.title}.md`,
      collisions: [],
      passages: draft.passages.map((p) => ({
        ...p,
        pages: p.pages ?? null,
        found: true,
        problem: null,
      })),
      executed: false,
    }),
    create: async (draft: ConceptDraft) => {
      created.push(draft);
      return {
        path: `3.Resources/Concepts/${draft.title}.md`,
        collisions: [],
        passages: [],
        executed: true,
      };
    },
  } as unknown as Synthesizing;
  return { synthesizing: () => synthesizing } as unknown as Coach;
}

describe('coach synthesize', () => {
  it('walks an idea from summary to a confirmed concept note', async () => {
    const created: ConceptDraft[] = [];
    const asked: string[][] = [];
    const term = new ScriptedTerminal([
      '1',
      '',
      '',
      'Each layer of a note is smaller.',
      '',
      'So I only reread the best parts.',
      '',
      '',
      'd',
      'Bold the main points before highlighting.',
      'A note grows layers over time.',
      '',
      '-',
      'y',
    ]);
    await synthesize(coachWith(created, asked), term, []);

    expect(asked).toEqual([['Each layer of a note is smaller.']]);
    expect(created).toEqual([
      {
        title: 'Layers',
        summary: 'Each layer of a note is smaller.',
        assertions: [
          'Each layer is smaller than the one before.',
          'Bold the main points before highlighting.',
          'A note grows layers over time.',
        ],
        buzzwords: [],
        passages: [
          {
            note: CH5,
            quote: 'highlight the best of what is bolded',
            pages: '98',
          },
        ],
        fromNotes: ['0.Inbox/Reading.md'],
      },
    ]);
    const text = term.text();
    expect(text).toContain(
      '1 highlights, 0 bolds, 0 summaries, 1 reading notes',
    );
    expect(text).toContain('Why bold before you highlight?');
    expect(text).toContain('found');
    expect(text).toContain('1 concept note(s) written.');
  });

  it('writes nothing when the learner declines the preview', async () => {
    const created: ConceptDraft[] = [];
    const term = new ScriptedTerminal([
      '',
      'Renamed',
      'My summary.',
      '',
      '/skip',
      '',
      '',
      '',
      '',
      '',
      'n',
    ]);
    await synthesize(coachWith(created, []), term, ['Building a Second Brain']);
    expect(created).toEqual([]);
    expect(term.text()).toContain(
      'Concept note, preview: 3.Resources/Concepts/Renamed.md',
    );
    expect(term.text()).toContain('No concept note written.');
  });

  it('stops on /quit without writing', async () => {
    const created: ConceptDraft[] = [];
    const term = new ScriptedTerminal(['1', '', '', '/quit']);
    await synthesize(coachWith(created, []), term, []);
    expect(created).toEqual([]);
    expect(term.text()).toContain('No concept note written.');
  });
});

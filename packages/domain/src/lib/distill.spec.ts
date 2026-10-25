import {
  conceptDraft,
  extractMarks,
  quotesFrom,
  type MaterialItem,
} from './distill.js';
import { DomainError } from './errors.js';

const CHAPTER = [
  '# Chapter 6: Distill',
  '',
  'From [[text|Book]], pages 98–99.',
  '',
  '> [!summary]',
  '> Layers let me grasp a note',
  '> in seconds.',
  '',
  '## Page 98',
  'Notes need **discoverability for the future**. Most of this page is plain text.',
  '**Bold the main points, then ==highlight the best of what is bolded== later.**',
  '',
  '> [!summary] Page idea: formatting marks the layers.',
  '',
  '## Page 99',
  'A __second bold style__ and ==a highlight that spans',
  'two lines of the page==.',
].join('\n');

describe('extractMarks', () => {
  it('finds the chapter summary, page summaries, highlights and bolds with their pages', () => {
    expect(extractMarks(CHAPTER)).toEqual([
      {
        kind: 'summary',
        text: 'Layers let me grasp a note in seconds.',
        page: null,
      },
      {
        kind: 'summary',
        text: 'Page idea: formatting marks the layers.',
        page: 98,
      },
      {
        kind: 'highlight',
        text: 'highlight the best of what is bolded',
        page: 98,
      },
      { kind: 'bold', text: 'discoverability for the future', page: 98 },
      {
        kind: 'bold',
        text: 'Bold the main points, then highlight the best of what is bolded later.',
        page: 98,
      },
      {
        kind: 'highlight',
        text: 'a highlight that spans two lines of the page',
        page: 99,
      },
      { kind: 'bold', text: 'second bold style', page: 99 },
    ]);
  });

  it('finds nothing in an untouched chapter', () => {
    expect(extractMarks('## Page 1\nPlain text only.')).toEqual([]);
  });
});

describe('quotesFrom', () => {
  const item = (
    id: number,
    kind: MaterialItem['kind'],
    text: string,
    page: number | null = 98,
  ): MaterialItem => ({
    id,
    kind,
    text,
    note: 'raw/ch6.md',
    chapter: 'Chapter 6',
    page,
  });

  it('prefers highlights, skips short or repeated text, summaries and notes', () => {
    expect(
      quotesFrom([
        item(1, 'bold', 'discoverability for the future'),
        item(2, 'highlight', 'highlight the best of what is bolded'),
        item(3, 'bold', 'too short'),
        item(4, 'summary', 'My own words are never a quote.'),
        item(5, 'note', 'A reading note is never a quote either.', null),
        item(6, 'highlight', 'Highlight the best of what is bolded'),
      ]),
    ).toEqual([
      {
        note: 'raw/ch6.md',
        quote: 'highlight the best of what is bolded',
        pages: '98',
      },
      {
        note: 'raw/ch6.md',
        quote: 'discoverability for the future',
        pages: '98',
      },
    ]);
  });
});

describe('conceptDraft', () => {
  const valid = {
    title: ' Progressive Summarization ',
    summary: 'Layers let me grasp a note in seconds.',
    assertions: ['Each layer is smaller than the last.', ' '],
    buzzwords: ['distill', 'distill'],
    passages: [
      {
        note: 'raw/ch6.md',
        quote: 'highlight the best of what is bolded',
        pages: '98',
      },
    ],
    fromNotes: ['0.Inbox/Reading.md', '0.Inbox/Reading.md'],
  };

  it('trims, removes empty assertions and duplicate buzzwords and notes', () => {
    expect(conceptDraft(valid)).toEqual({
      ...valid,
      title: 'Progressive Summarization',
      assertions: ['Each layer is smaller than the last.'],
      buzzwords: ['distill'],
      fromNotes: ['0.Inbox/Reading.md'],
    });
  });

  it('refuses a concept the vault would refuse', () => {
    expect(() => conceptDraft({ ...valid, summary: ' ' })).toThrow(
      /summary in your own words/,
    );
    expect(() => conceptDraft({ ...valid, assertions: [] })).toThrow(
      DomainError,
    );
    expect(() =>
      conceptDraft({ ...valid, assertions: Array(7).fill('A claim.') }),
    ).toThrow(/1 to 6/);
    expect(() =>
      conceptDraft({ ...valid, buzzwords: ['a', 'b', 'c', 'd', 'e', 'f'] }),
    ).toThrow(/at most 5/);
    expect(() => conceptDraft({ ...valid, passages: [] })).toThrow(/1 to 12/);
    expect(() =>
      conceptDraft({ ...valid, passages: [{ note: 'x', quote: 'tiny' }] }),
    ).toThrow(/at least 12/);
  });
});

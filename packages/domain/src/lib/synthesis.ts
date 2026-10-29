import { DomainError } from './errors.js';

export type MarkKind = 'highlight' | 'bold' | 'summary';

export interface Mark {
  kind: MarkKind;
  text: string;
  page: number | null;
  within?: string;
}

export type MaterialKind = MarkKind | 'note';

export interface MaterialItem {
  id: number;
  kind: MaterialKind;
  text: string;
  note: string;
  chapter: string;
  page: number | null;
  within?: string;
}

export interface ConceptPassageDraft {
  note: string;
  quote: string;
  pages?: string;
}

export interface ConceptDraft {
  title: string;
  summary: string;
  assertions: string[];
  buzzwords: string[];
  passages: ConceptPassageDraft[];
  fromNotes: string[];
}

export const MAX_ASSERTIONS = 6;
export const MAX_BUZZWORDS = 5;
export const MAX_PASSAGES = 12;
export const MIN_QUOTE = 12;
export const MIN_QUOTE_WORDS = 5;
export const WHY_IT_MATTERS =
  'Why does this idea matter: what problem does it solve, or what goes wrong without it?';

const SUMMARY = /^>[ \t]*\[!summary\][^\n]*(?:\n>[^\n]*)*/gim;
const HIGHLIGHT = /==(?=\S)(?:(?!\n[ \t]*\n)[\s\S])*?\S==/g;
const BOLD = /(\*\*|__)(?=\S)(?:(?!\n[ \t]*\n)[\s\S])*?\S\1/g;
const BOLD_RUN = /(\*\*|__)[ \t]*\n[ \t]*\1/g;
const HIGHLIGHT_RUN = /==[ \t]*\n[ \t]*==/g;

function clean(text: string): string {
  return text
    .replace(/==|\*\*|__/g, '')
    .replace(/(\p{L})-[ \t]*\n[ \t]*(\p{Ll})/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

function joinRuns(text: string): string {
  return text.replace(BOLD_RUN, '\n').replace(HIGHLIGHT_RUN, '\n');
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function summaries(text: string): string[] {
  return [...text.matchAll(SUMMARY)]
    .map((m) => {
      const [first, ...rest] = m[0].split('\n');
      return [
        first!.replace(/^>[ \t]*\[!summary\][-+]?/i, ''),
        ...rest.map((l) => l.replace(/^>[ \t]?/, '')),
      ]
        .join(' ')
        .trim();
    })
    .filter(Boolean)
    .map(clean);
}

function marksOn(text: string, page: number | null): Mark[] {
  const marks: Mark[] = summaries(text).map((s) => ({
    kind: 'summary',
    text: s,
    page,
  }));
  const author = joinRuns(text.replace(SUMMARY, ''));
  const bolds = [...author.matchAll(BOLD)].map((m) => ({
    from: m.index,
    to: m.index + m[0].length,
    text: clean(m[0]),
  }));
  const highlighted: [number, number][] = [];
  for (const m of author.matchAll(HIGHLIGHT)) {
    const from = m.index;
    const to = m.index + m[0].length;
    highlighted.push([from, to]);
    const bold = bolds.find((b) => from >= b.from && to <= b.to);
    marks.push({
      kind: 'highlight',
      text: clean(m[0]),
      page,
      ...(bold ? { within: bold.text } : {}),
    });
  }
  for (const bold of bolds) {
    const inside = highlighted.some(
      ([from, to]) => bold.from >= from && bold.to <= to,
    );
    if (!inside) marks.push({ kind: 'bold', text: bold.text, page });
  }
  return marks.filter((m) => m.text);
}

export function extractMarks(body: string): Mark[] {
  const parts = body.split(/^(?=## Page \d+[ \t]*$)/m);
  return parts.flatMap((part) => {
    const heading = /^## Page (\d+)[ \t]*\n?/.exec(part);
    return heading
      ? marksOn(part.slice(heading[0].length), Number(heading[1]))
      : summaries(part).map((s): Mark => ({
          kind: 'summary',
          text: s,
          page: null,
        }));
  });
}

export function quotesFrom(
  items: readonly MaterialItem[],
): ConceptPassageDraft[] {
  const ranked = [
    ...items
      .filter((i) => i.kind === 'highlight')
      .map((i) => ({ ...i, text: i.within ?? i.text })),
    ...items.filter((i) => i.kind === 'bold'),
  ];
  const kept: string[] = [];
  const quotes: ConceptPassageDraft[] = [];
  for (const item of ranked) {
    const key = item.text.toLowerCase();
    if (item.text.length < MIN_QUOTE || wordCount(item.text) < MIN_QUOTE_WORDS)
      continue;
    if (kept.some((k) => k.includes(key))) continue;
    kept.push(key);
    quotes.push({
      note: item.note,
      quote: item.text,
      ...(item.page !== null ? { pages: String(item.page) } : {}),
    });
    if (quotes.length === MAX_PASSAGES) break;
  }
  return quotes;
}

export function conceptDraft(input: ConceptDraft): ConceptDraft {
  const title = input.title.trim();
  const summary = input.summary.trim();
  const assertions = input.assertions.map((a) => a.trim()).filter(Boolean);
  const buzzwords = [
    ...new Set(input.buzzwords.map((b) => b.trim()).filter(Boolean)),
  ];
  if (!title) throw new DomainError('A concept needs a title');
  if (!summary)
    throw new DomainError('A concept needs a summary in your own words');
  if (assertions.length < 1 || assertions.length > MAX_ASSERTIONS) {
    throw new DomainError(
      `A concept needs 1 to ${MAX_ASSERTIONS} core assertions, got ${assertions.length}`,
    );
  }
  if (buzzwords.length > MAX_BUZZWORDS) {
    throw new DomainError(
      `A concept bans at most ${MAX_BUZZWORDS} buzzwords, got ${buzzwords.length}`,
    );
  }
  if (input.passages.length < 1 || input.passages.length > MAX_PASSAGES) {
    throw new DomainError(
      `A concept needs 1 to ${MAX_PASSAGES} source passages, got ${input.passages.length}`,
    );
  }
  const short = input.passages.find((p) => p.quote.trim().length < MIN_QUOTE);
  if (short)
    throw new DomainError(
      `A quote needs at least ${MIN_QUOTE} characters: "${short.quote}"`,
    );
  return {
    title,
    summary,
    assertions,
    buzzwords,
    passages: input.passages.map((p) => ({ ...p, quote: p.quote.trim() })),
    fromNotes: [...new Set(input.fromNotes)],
  };
}

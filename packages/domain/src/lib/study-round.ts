import { DomainError } from './errors.js';
import { longestSharedRun, words } from './text.js';

export class StudyRoundError extends DomainError {
  override readonly name = 'StudyRoundError';
}

export type GapStatus = 'open' | 'closed' | 'unresolved';

export interface StudiedGap {
  gap: string;
  status: GapStatus;
  attempts: number;
  explanation: string | null;
}

export type StudyProgress = 'closed' | 'retry' | 'unresolved';

export class StudyRound {
  private readonly items: StudiedGap[];

  private constructor(
    gaps: string[],
    private readonly maxAttempts: number,
  ) {
    this.items = gaps.map((gap) => ({
      gap,
      status: 'open',
      attempts: 0,
      explanation: null,
    }));
  }

  static over(gaps: string[], maxAttempts = 2): StudyRound {
    const cleaned = gaps.map((g) => g.trim()).filter(Boolean);
    if (!cleaned.length)
      throw new StudyRoundError('There are no gaps to study');
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      throw new StudyRoundError('A gap needs at least one attempt');
    }
    return new StudyRound(cleaned, maxAttempts);
  }

  get current(): StudiedGap | null {
    const open = this.items.find((g) => g.status === 'open');
    return open ? { ...open } : null;
  }

  get position(): { index: number; total: number } {
    const index = this.items.findIndex((g) => g.status === 'open');
    return {
      index: index < 0 ? this.items.length : index,
      total: this.items.length,
    };
  }

  get isFinished(): boolean {
    return this.current === null;
  }

  get gaps(): readonly StudiedGap[] {
    return this.items.map((g) => ({ ...g }));
  }

  skip(): void {
    const gap = this.items.find((g) => g.status === 'open');
    if (!gap) throw new StudyRoundError('Every gap has been studied');
    gap.status = 'unresolved';
  }

  record(explanation: string, closed: boolean): StudyProgress {
    const gap = this.items.find((g) => g.status === 'open');
    if (!gap) throw new StudyRoundError('Every gap has been studied');
    const text = explanation.trim();
    if (!text) throw new StudyRoundError('An explanation cannot be empty');
    gap.attempts++;
    gap.explanation = text;
    if (closed) {
      gap.status = 'closed';
      return 'closed';
    }
    if (gap.attempts >= this.maxAttempts) {
      gap.status = 'unresolved';
      return 'unresolved';
    }
    return 'retry';
  }
}

const MIN_PASSAGE_SCORE = 2.5;

export interface Passage {
  text: string;
  page: number | null;
}

export function stem(word: string): string {
  for (const suffix of ['ing', 'ed', 'es', 's', 'e']) {
    if (word.length > suffix.length + 3 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

const STOPWORDS = new Set(
  'that this with from have what your their there which about would could should into they them then than when where while does were been being also only just more most some such very will shall these those other each make makes made into over under like learner explain explained explains describe described note notes'.split(
    ' ',
  ),
);

function chunks(body: string, size: number): Passage[] {
  const out: Passage[] = [];
  let page: number | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length) out.push({ text: buffer.join(' '), page });
    buffer = [];
  };
  const lines = body.split('\n');
  const firstPage = lines.findIndex((l) => /^##\s+Page\s+\d+\s*$/.test(l));
  for (const line of firstPage > 0 ? lines.slice(firstPage) : lines) {
    const heading = /^##\s+Page\s+(\d+)\s*$/.exec(line);
    if (heading) {
      flush();
      page = Number(heading[1]);
      continue;
    }
    if (/^#/.test(line) || !line.trim()) continue;
    for (const word of line.trim().split(/\s+/)) {
      buffer.push(word);
      if (buffer.length >= size) flush();
    }
  }
  flush();
  return out;
}

export function quotedPassage(
  body: string,
  quote: string,
  size = 70,
): Passage | null {
  if (words(quote).length < 6) return null;
  let best: { passage: Passage; run: number } | null = null;
  for (const passage of chunks(body, size)) {
    const run = longestSharedRun(quote, passage.text);
    if (!best || run > best.run) best = { passage, run };
  }
  return best && best.run >= 6 ? best.passage : null;
}

export function scorePassage(
  body: string,
  query: string,
  size = 70,
): { passage: Passage; score: number } | null {
  const all = chunks(body, size).map((passage) => ({
    passage,
    words: new Set(words(passage.text).map(stem)),
  }));
  const terms = [
    ...new Set(
      words(query)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
        .map(stem),
    ),
  ];
  if (!terms.length || !all.length) return null;
  const weight = new Map(
    terms.map((t) => {
      const df = all.filter((c) => c.words.has(t)).length;
      if (!df) return [t, 0];
      return [t, all.length < 3 ? 1 : Math.log((all.length + 1) / (df + 0.5))];
    }),
  );
  let best: { passage: Passage; score: number; hits: number } | null = null;
  for (const chunk of all) {
    const hits = terms.filter((t) => chunk.words.has(t));
    const score = hits.reduce((sum, t) => sum + weight.get(t)!, 0);
    if (!best || score > best.score)
      best = { passage: chunk.passage, score, hits: hits.length };
  }
  const minimum = all.length < 3 ? 2 : MIN_PASSAGE_SCORE;
  return best && best.hits >= 2 && best.score >= minimum
    ? { passage: best.passage, score: best.score }
    : null;
}

export function locatePassage(
  body: string,
  query: string,
  size = 70,
): Passage | null {
  return scorePassage(body, query, size)?.passage ?? null;
}

export function groundedIn(body: string, gap: string): boolean {
  return scorePassage(body, gap) !== null;
}

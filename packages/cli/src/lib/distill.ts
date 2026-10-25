import {
  VaultRefusedError,
  type BookProgress,
  type ConceptCheck,
  type Distilling,
  type Idea,
} from '@ai-coach/application';
import {
  DomainError,
  MAX_ASSERTIONS,
  type ConceptDraft,
  type Exchange,
  type MaterialItem,
} from '@ai-coach/domain';
import { UsageError } from './commands.js';
import type { Coach } from './composition.js';
import { confirm, paint, readAnswer, type Terminal } from './terminal.js';

class Quit extends Error {}

function numbers(raw: string, count: number): number[] {
  const picks = raw.trim()
    ? raw
        .trim()
        .split(/[\s,]+/)
        .map(Number)
    : Array.from({ length: count }, (_, i) => i + 1);
  const bad = picks.filter((n) => !Number.isInteger(n) || n < 1 || n > count);
  if (bad.length) throw new UsageError(`Not on the list: ${bad.join(', ')}`);
  return [...new Set(picks)];
}

async function chooseBook(
  distilling: Distilling,
  term: Terminal,
): Promise<BookProgress | null> {
  const books = await distilling.books();
  if (!books.length) {
    term.print(
      'No converted books yet: convert a PDF under 3.Resources/0.Raw first.',
    );
    return null;
  }
  books.forEach((b, i) => {
    const complete = b.chapters.filter((c) => c.state === 'complete').length;
    const started = b.chapters.filter((c) => c.state === 'in_progress').length;
    term.print(
      `${String(i + 1).padStart(3)}. ${b.title} ${paint('dim', `(${b.stage}; ${complete} chapters summarized, ${started} marked, ${b.notes.length} reading notes)`)}`,
    );
  });
  const raw = await term.ask('Which book? ');
  if (raw === null || !raw.trim()) return null;
  const [n] = numbers(raw, books.length);
  return books[n! - 1]!;
}

function where(item: MaterialItem): string {
  return item.page === null ? item.chapter : `${item.chapter} p. ${item.page}`;
}

function showMaterial(term: Terminal, items: readonly MaterialItem[]): void {
  for (const item of items) {
    const text =
      item.text.length > 160 ? `${item.text.slice(0, 157)}…` : item.text;
    term.print(`  ${paint('dim', `[${item.kind}, ${where(item)}]`)} ${text}`);
  }
}

function counts(material: readonly MaterialItem[]): string {
  const of = (kind: MaterialItem['kind']) =>
    material.filter((m) => m.kind === kind).length;
  return `${of('highlight')} highlights, ${of('bold')} bolds, ${of('summary')} summaries, ${of('note')} reading notes`;
}

async function answer(term: Terminal): Promise<string | null> {
  const input = await readAnswer(term);
  if (input.kind === 'quit') throw new Quit();
  return input.kind === 'skip' ? null : input.text.trim();
}

async function reviewAssertions(
  term: Terminal,
  drafted: string[],
): Promise<string[]> {
  const kept: string[] = [];
  if (drafted.length) {
    term.print(
      paint(
        'bold',
        'Core assertions drafted from your words. Enter keeps one, "d" drops it, or type a better one:',
      ),
    );
  }
  for (const [i, assertion] of drafted.entries()) {
    term.print(`  ${i + 1}. ${assertion}`);
    const raw = await term.ask('     > ');
    if (raw === null) throw new Quit();
    const reply = raw.trim();
    if (!reply) kept.push(assertion);
    else if (reply.toLowerCase() !== 'd') kept.push(reply);
  }
  term.print(
    paint(
      'dim',
      kept.length
        ? 'Add more assertions, one per line; an empty line ends.'
        : 'Write the core assertions yourself, one per line; an empty line ends.',
    ),
  );
  while (kept.length < MAX_ASSERTIONS) {
    const raw = await term.ask('  + ');
    if (raw === null) throw new Quit();
    if (!raw.trim()) break;
    kept.push(raw.trim());
  }
  return kept;
}

async function reviewBuzzwords(
  term: Terminal,
  suggested: string[],
): Promise<string[]> {
  const shown = suggested.length ? suggested.join(', ') : 'none';
  const raw = await term.ask(
    `Buzzwords to ban when you explain it [${shown}]: Enter keeps, "-" for none, or a comma list: `,
  );
  if (raw === null) throw new Quit();
  const reply = raw.trim();
  if (!reply) return suggested;
  if (reply === '-') return [];
  return reply
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
}

function showCheck(
  term: Terminal,
  draft: ConceptDraft,
  check: ConceptCheck,
): void {
  term.print(
    paint('bold', `Concept note, preview: ${check.path ?? draft.title}`),
  );
  term.print(`  ${draft.summary.replace(/\s*\n\s*/g, ' ')}`);
  for (const a of draft.assertions) term.print(`  - ${a}`);
  if (draft.buzzwords.length)
    term.print(paint('dim', `  banned: ${draft.buzzwords.join(', ')}`));
  for (const p of check.passages) {
    const mark = p.found
      ? paint('green', 'found')
      : paint('red', `not found: ${p.problem ?? ''}`);
    term.print(
      `  > "${p.quote}" ${paint('dim', `${p.note}${p.pages ? ` p. ${p.pages}` : ''}`)} ${mark}`,
    );
  }
  if (draft.fromNotes.length)
    term.print(paint('dim', `  from: ${draft.fromNotes.join(', ')}`));
  for (const c of check.collisions)
    term.print(paint('red', `  collision: ${c}`));
}

async function distillIdea(
  distilling: Distilling,
  term: Terminal,
  book: BookProgress,
  idea: Idea,
): Promise<boolean> {
  term.print();
  term.print(paint('bold', idea.title));
  showMaterial(term, idea.items);
  const renamed = await term.ask(`Title [${idea.title}]: `);
  if (renamed === null) throw new Quit();
  const title = renamed.trim() || idea.title;

  term.print(
    paint(
      'cyan',
      'Summarize the idea in your own words. An empty line ends; /skip skips this idea, /quit stops.',
    ),
  );
  const summary = await answer(term);
  if (!summary) return false;

  const answers: Exchange[] = [];
  for (const question of await distilling.questions(
    { ...idea, title },
    summary,
  )) {
    term.print(paint('cyan', question));
    const reply = await answer(term);
    if (reply) answers.push({ question, answer: reply });
  }

  term.print(paint('dim', 'Drafting core assertions from your words…'));
  const assertions = await reviewAssertions(
    term,
    await distilling.assertions({ ...idea, title }, summary, answers),
  );
  if (!assertions.length) {
    term.print(
      paint(
        'yellow',
        'A concept note needs at least one core assertion; this idea is skipped.',
      ),
    );
    return false;
  }
  const buzzwords = await reviewBuzzwords(
    term,
    await distilling.buzzwords(idea),
  );
  const passages = await distilling.passages(idea, book);
  if (!passages.length) {
    term.print(
      paint(
        'yellow',
        'No passage of the book to quote for this idea: highlight or bold it in the chapter, then run distill again.',
      ),
    );
    return false;
  }
  const fromNotes = [
    ...new Set(idea.items.filter((i) => i.kind === 'note').map((i) => i.note)),
  ];

  try {
    const draft = distilling.draft({
      title,
      summary,
      assertions,
      buzzwords,
      passages,
      fromNotes,
    });
    const check = await distilling.preview(draft);
    showCheck(term, draft, check);
    if (check.collisions.length) {
      term.print(
        paint('red', 'A note with that title exists; nothing was written.'),
      );
      return false;
    }
    if (!(await confirm(term, 'Write this concept note?'))) {
      term.print('Nothing written.');
      return false;
    }
    const done = await distilling.create(draft);
    term.print(
      done.executed
        ? paint('green', `Written: ${done.path}`)
        : paint('red', 'Not written.'),
    );
    return done.executed;
  } catch (err) {
    if (err instanceof DomainError || err instanceof VaultRefusedError) {
      term.print(paint('red', err.message));
      return false;
    }
    throw err;
  }
}

export async function distill(
  coach: Coach,
  term: Terminal,
  args: string[],
): Promise<void> {
  const distilling = coach.distilling();
  const book = args.length
    ? await distilling.book(args.join(' '))
    : await chooseBook(distilling, term);
  if (!book) return;
  const material = await distilling.gather(book);
  if (!material.length) {
    term.print(
      `Nothing marked in ${book.title} yet: bold or highlight passages, or write a chapter summary, then come back.`,
    );
    return;
  }
  term.print(
    paint(
      'dim',
      `${book.title}: ${counts(material)}. Grouping them into ideas…`,
    ),
  );
  const ideas = await distilling.ideas(material);
  ideas.forEach((idea, i) =>
    term.print(
      `${String(i + 1).padStart(3)}. ${idea.title} ${paint('dim', `(${idea.items.length} item${idea.items.length === 1 ? '' : 's'}: ${[...new Set(idea.items.map(where))].slice(0, 3).join('; ')})`)}`,
    ),
  );
  const raw = await term.ask(
    'Distill which ideas? Numbers separated by spaces, Enter for all: ',
  );
  if (raw === null) return;
  let written = 0;
  try {
    for (const n of numbers(raw, ideas.length)) {
      if (await distillIdea(distilling, term, book, ideas[n - 1]!)) written++;
    }
  } catch (err) {
    if (!(err instanceof Quit)) throw err;
  }
  term.print(
    written
      ? `${written} concept note(s) written. Spar them with coach spar.`
      : 'No concept note written.',
  );
}

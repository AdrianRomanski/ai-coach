import {
  MAX_ASSERTIONS,
  MAX_BUZZWORDS,
  MIN_QUOTE,
  conceptDraft,
  extractMarks,
  quotesFrom,
  type ConceptDraft,
  type ConceptPassageDraft,
  type Exchange,
  type MaterialItem,
  type SparringRules,
} from '@ai-coach/domain';
import { NotFoundError, UnusableReplyError } from '../errors.js';
import type {
  BookProgress,
  ConceptCheck,
  DistillPartner,
  IdeaProposal,
  Library,
} from '../ports/library.js';
import type { NotesRepository } from '../ports/vault.js';

export interface Idea {
  title: string;
  items: MaterialItem[];
}

export interface DistillingDeps {
  notes: NotesRepository;
  library: Library;
  partner: DistillPartner;
  rules: SparringRules;
}

const MAX_IDEAS = 6;
const MAX_QUESTIONS = 2;
const NOTE_EXCERPT = 800;

function quoteFromSnippet(snippet: string): string | null {
  const trimmed = snippet.replace(/^…\s*/, '').replace(/\s*…$/, '').trim();
  const sentences = trimmed.match(/[A-Z][^.!?]*[.!?]/g) ?? [];
  const best = sentences.sort((a, b) => b.length - a.length)[0] ?? trimmed;
  return best.length >= MIN_QUOTE ? best.trim() : null;
}

export class Distilling {
  constructor(private readonly deps: DistillingDeps) {}

  books(): Promise<BookProgress[]> {
    return this.deps.library.readingProgress();
  }

  async book(ref: string): Promise<BookProgress> {
    const wanted = ref.trim().replace(/\/+$/, '').toLowerCase();
    const books = await this.deps.library.readingProgress();
    const found = books.find(
      (b) =>
        b.index.toLowerCase() === wanted ||
        b.folder.toLowerCase() === wanted ||
        b.title.toLowerCase() === wanted,
    );
    if (!found) {
      throw new NotFoundError(
        `No converted book matches "${ref}"; known books: ${books.map((b) => b.title).join(', ') || 'none'}`,
      );
    }
    return found;
  }

  async gather(book: BookProgress): Promise<MaterialItem[]> {
    const items: Omit<MaterialItem, 'id'>[] = [];
    for (const chapter of book.chapters.filter(
      (c) => c.state !== 'untouched',
    )) {
      const note = await this.deps.notes.readNote(chapter.path);
      for (const mark of extractMarks(note.body)) {
        items.push({ ...mark, note: chapter.path, chapter: chapter.title });
      }
    }
    for (const path of book.notes) {
      const note = await this.deps.notes.readNote(path);
      const text = note.body.replace(/\s+/g, ' ').trim().slice(0, NOTE_EXCERPT);
      if (text)
        items.push({
          kind: 'note',
          text,
          note: path,
          chapter: note.title,
          page: null,
        });
    }
    return items.map((item, i) => ({ ...item, id: i + 1 }));
  }

  async ideas(material: readonly MaterialItem[]): Promise<Idea[]> {
    const byId = new Map(material.map((m) => [m.id, m]));
    let proposals: IdeaProposal[] = [];
    try {
      proposals = await this.deps.partner.proposeIdeas({
        rules: this.deps.rules,
        material,
        max: MAX_IDEAS,
      });
    } catch (err) {
      if (!(err instanceof UnusableReplyError)) throw err;
    }
    const ideas = proposals
      .map((p) => ({
        title: p.title.trim(),
        items: [...new Set(p.items)]
          .map((id) => byId.get(id))
          .filter((m): m is MaterialItem => !!m),
      }))
      .filter((idea) => idea.title && idea.items.length)
      .slice(0, MAX_IDEAS);
    if (ideas.length) return ideas;
    const byChapter = new Map<string, MaterialItem[]>();
    for (const item of material) {
      byChapter.set(item.chapter, [
        ...(byChapter.get(item.chapter) ?? []),
        item,
      ]);
    }
    return [...byChapter].map(([title, items]) => ({ title, items }));
  }

  async questions(idea: Idea, summary: string): Promise<string[]> {
    try {
      const asked = await this.deps.partner.gapQuestions({
        rules: this.deps.rules,
        title: idea.title,
        summary,
        material: idea.items,
        max: MAX_QUESTIONS,
      });
      return asked
        .map((q) => q.trim())
        .filter(Boolean)
        .slice(0, MAX_QUESTIONS);
    } catch (err) {
      if (err instanceof UnusableReplyError) return [];
      throw err;
    }
  }

  async assertions(
    idea: Idea,
    summary: string,
    answers: readonly Exchange[],
  ): Promise<string[]> {
    try {
      const drafted = await this.deps.partner.draftAssertions({
        rules: this.deps.rules,
        title: idea.title,
        summary,
        answers,
        max: MAX_ASSERTIONS,
      });
      return drafted
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, MAX_ASSERTIONS);
    } catch (err) {
      if (err instanceof UnusableReplyError) return [];
      throw err;
    }
  }

  async buzzwords(idea: Idea): Promise<string[]> {
    try {
      const suggested = await this.deps.partner.suggestBuzzwords({
        rules: this.deps.rules,
        title: idea.title,
        material: idea.items,
        max: MAX_BUZZWORDS,
      });
      return [...new Set(suggested.map((b) => b.trim()).filter(Boolean))].slice(
        0,
        MAX_BUZZWORDS,
      );
    } catch (err) {
      if (err instanceof UnusableReplyError) return [];
      throw err;
    }
  }

  async passages(
    idea: Idea,
    book: BookProgress,
  ): Promise<ConceptPassageDraft[]> {
    const marked = quotesFrom(idea.items);
    if (marked.length) return marked;
    const found: ConceptPassageDraft[] = [];
    for (const item of idea.items.filter(
      (i) => i.kind === 'note' || i.kind === 'summary',
    )) {
      const hits = await this.deps.library.findPassages(
        item.text.slice(0, 200),
        {
          within: book.folder,
          limit: 2,
        },
      );
      for (const hit of hits) {
        const quote = quoteFromSnippet(hit.snippet);
        if (quote && !found.some((f) => f.quote === quote)) {
          found.push({
            note: hit.note,
            quote,
            ...(hit.page !== null ? { pages: String(hit.page) } : {}),
          });
        }
      }
      if (found.length >= 3) break;
    }
    return found.slice(0, 3);
  }

  draft(input: ConceptDraft): ConceptDraft {
    return conceptDraft(input);
  }

  async preview(draft: ConceptDraft): Promise<ConceptCheck> {
    return this.deps.library.createConcept(conceptDraft(draft), false);
  }

  async create(draft: ConceptDraft): Promise<ConceptCheck> {
    return this.deps.library.createConcept(conceptDraft(draft), true);
  }
}

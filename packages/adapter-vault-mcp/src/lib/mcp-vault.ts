import {
  UnavailableError,
  UnusableReplyError,
  VaultRefusedError,
  type BookChapter,
  type BookProgress,
  type ConceptCheck,
  type DueReport,
  type FilingPlan,
  type FilingRequest,
  type Library,
  type NoteDetails,
  type NoteListing,
  type NotesRepository,
  type PassageHit,
  type RecordedSession,
  type SessionDraft,
  type SessionLog,
  type VaultFiling,
} from '@ai-coach/application';
import {
  isCoachingStyle,
  tier2Payload,
  type ConceptDraft,
  type ParaBucket,
  type Tier2Payload,
} from '@ai-coach/domain';
import { z } from 'zod';
import type { FilingResult, ReadNoteResult } from './schemas.js';
import {
  VaultClient,
  VaultContractError,
  VaultToolError,
  type VaultClientOptions,
} from './vault-client.js';

function translate(err: unknown): never {
  if (err instanceof VaultToolError) throw new VaultRefusedError(err.message);
  if (err instanceof VaultContractError)
    throw new UnusableReplyError('vault', err.message);
  throw err;
}

function plan(result: FilingResult): FilingPlan {
  return {
    actions: result.actions,
    collisions: result.collisions,
    warnings: result.warnings,
    suggestions: result.suggestions ?? [],
    executed: result.executed,
  };
}

const ChapterFrontmatter = z.object({
  book: z.string(),
  part: z.string().optional(),
  chapter: z.number(),
  section: z.string().optional(),
  pages: z.string(),
});

function chapterOf(note: ReadNoteResult): BookChapter | null {
  if (note.rawRole !== 'chapter') return null;
  const parsed = ChapterFrontmatter.safeParse(note.frontmatter);
  if (!parsed.success) return null;
  const { book, part, chapter, section, pages } = parsed.data;
  return { book, part: part ?? null, chapter, section: section ?? null, pages };
}

function details(note: ReadNoteResult): NoteDetails {
  return {
    path: note.path,
    title: note.title,
    bucket: note.bucket,
    container: note.container,
    coachId: note.coachId,
    mastery: note.history.mastery,
    nextReview: note.history.nextReview,
    body: note.body,
    raw: note.raw,
    rawRole: note.rawRole,
    chapter: chapterOf(note),
    concept: note.concept
      ? {
          assertions: note.concept.coreAssertions,
          buzzwords: note.concept.forbiddenBuzzwords,
          passages: note.concept.passages.map((p) => ({
            quote: p.quote,
            note: p.note,
            pages: p.pages ?? null,
            found: p.found,
          })),
          problems: note.concept.problems,
        }
      : null,
    style: isCoachingStyle(note.frontmatter['style'])
      ? note.frontmatter['style']
      : null,
    sessions: note.history.entries.map((e) => ({
      sessionId: e.session_id,
      tier: e.tier,
      date: e.date,
      verdict: e.verdict,
      gaps: e.gaps,
      nextReview: e.next_review,
    })),
  };
}

export class McpVault
  implements NotesRepository, SessionLog, VaultFiling, Library
{
  private constructor(private readonly client: VaultClient) {}

  static async connect(options: VaultClientOptions): Promise<McpVault> {
    try {
      return new McpVault(await VaultClient.connect(options));
    } catch (err) {
      throw new UnavailableError('vault', (err as Error).message, {
        cause: err,
      });
    }
  }

  close(): Promise<void> {
    return this.client.close();
  }

  async listNotes(
    filter: { bucket?: ParaBucket | 'out_of_place' } = {},
  ): Promise<NoteListing> {
    const result = await this.client.listNotes(filter).catch(translate);
    return {
      counts: result.counts,
      notes: result.notes,
      invalidSessions: result.invalidSessions,
    };
  }

  async readNote(path: string): Promise<NoteDetails> {
    return details(await this.client.readNote(path).catch(translate));
  }

  async dueForReview(today: string): Promise<DueReport> {
    return this.client.dueForReview({ today }).catch(translate);
  }

  async record(
    draft: SessionDraft,
    execute: boolean,
  ): Promise<RecordedSession> {
    const result = await this.client
      .recordSession({
        tier: draft.tier,
        date: draft.date,
        execute,
        items: draft.items.map((item) => {
          const fields = {
            challenge: item.challenge,
            answer: item.answer,
            verdict: item.verdict,
            gaps: item.gaps,
            next_review: item.nextReview,
          };
          return 'coachId' in item.note
            ? { coach_id: item.note.coachId, ...fields }
            : { note: item.note.path, ...fields };
        }),
      })
      .catch(translate);
    return {
      executed: result.executed,
      sessionId: result.session_id,
      items: result.items.map((i) => ({
        notePath: i.note,
        coachId: i.coach_id,
        verdict: i.verdict,
        nextReview: i.next_review,
      })),
    };
  }

  async tier2Payload(
    sessionId: string,
    options: { includeAssertions?: boolean } = {},
  ): Promise<Tier2Payload> {
    const include = options.includeAssertions === true;
    const raw = await this.client
      .tier2Payload(sessionId, include)
      .catch(translate);
    return tier2Payload(
      {
        items: raw.items.map(({ core_assertions, ...item }) =>
          include && core_assertions
            ? { ...item, coreAssertions: core_assertions }
            : item,
        ),
      },
      { allowAssertions: include },
    );
  }

  async plan(request: FilingRequest, execute: boolean): Promise<FilingPlan> {
    switch (request.kind) {
      case 'file':
        return plan(
          await this.client
            .fileNote({ path: request.path, to: request.to, execute })
            .catch(translate),
        );
      case 'capture':
        return plan(
          await this.client
            .capture({ title: request.title, body: request.body, execute })
            .catch(translate),
        );
      case 'archive':
        return plan(
          await this.client
            .archiveProject({
              project: request.project,
              ...(request.keep?.length ? { keep: request.keep } : {}),
              execute,
            })
            .catch(translate),
        );
      case 'init':
        return plan(await this.client.initVault({ execute }).catch(translate));
    }
  }

  async readingProgress(book?: string): Promise<BookProgress[]> {
    const books = await this.client
      .readingProgress(book ? { book } : {})
      .catch(translate);
    return books.map((b) => ({
      index: b.index,
      folder: b.index.replace(/\/[^/]+$/, ''),
      title: b.title,
      author: b.author,
      stage: b.stage,
      notes: b.steps.notes,
      chapters: b.chapters.map(({ path, title, summary, state }) => ({
        path,
        title,
        summary,
        state,
      })),
    }));
  }

  async findPassages(
    query: string,
    options: { within?: string; limit?: number } = {},
  ): Promise<PassageHit[]> {
    const hits = await this.client
      .findPassages({ query, ...options })
      .catch(translate);
    return hits.map(({ note, title, page, snippet }) => ({
      note,
      title,
      page,
      snippet,
    }));
  }

  async createConcept(
    draft: ConceptDraft,
    execute: boolean,
  ): Promise<ConceptCheck> {
    const result = await this.client
      .createConcept({
        title: draft.title,
        summary: draft.summary,
        core_assertions: draft.assertions,
        ...(draft.buzzwords.length
          ? { forbidden_buzzwords: draft.buzzwords }
          : {}),
        passages: draft.passages,
        ...(draft.fromNotes.length ? { from_notes: draft.fromNotes } : {}),
        execute,
      })
      .catch(translate);
    return {
      path: result.path,
      collisions: result.collisions,
      passages: result.passages.map((p) => ({
        note: p.note,
        quote: p.quote,
        pages: p.pages ?? null,
        found: p.found,
        problem: p.problem ?? null,
      })),
      executed: result.executed,
    };
  }
}

import {
  UnavailableError,
  UnusableReplyError,
  VaultRefusedError,
  type BookChapter,
  type DueReport,
  type FilingPlan,
  type FilingRequest,
  type NoteDetails,
  type NoteListing,
  type NotesRepository,
  type RecordedSession,
  type SessionDraft,
  type SessionLog,
  type VaultFiling,
} from '@ai-coach/application';
import {
  tier2Payload,
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
    rawRole: note.rawRole,
    chapter: chapterOf(note),
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

export class McpVault implements NotesRepository, SessionLog, VaultFiling {
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

  async tier2Payload(sessionId: string): Promise<Tier2Payload> {
    return tier2Payload(
      await this.client.tier2Payload(sessionId).catch(translate),
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
            .archiveProject({ project: request.project, execute })
            .catch(translate),
        );
      case 'init':
        return plan(await this.client.initVault({ execute }).catch(translate));
    }
  }
}

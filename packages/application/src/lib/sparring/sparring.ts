import {
  scheduleReview,
  type Ladder,
  type SparringResult,
  type SparringRules,
} from '@ai-coach/domain';
import { NotFoundError, NotSparrableError } from '../errors.js';
import { resourcesByCoachId, tier2History } from '../history.js';
import type { SparringPartner } from '../ports/models.js';
import type { PendingJudgements } from '../ports/state.js';
import type {
  NoteDetails,
  NotesRepository,
  RecordedSession,
  SessionDraft,
  SessionLog,
} from '../ports/vault.js';
import { SparringConversation } from './conversation.js';

export interface SparringCandidate {
  path: string;
  title: string;
  reason: string;
}

export interface SparredNote {
  note: NoteDetails;
  result: SparringResult;
}

export interface Tier1Plan {
  draft: SessionDraft;
  preview: RecordedSession;
  titles: string[];
}

export interface SparringDeps {
  notes: NotesRepository;
  sessions: SessionLog;
  pending: PendingJudgements;
  partner: SparringPartner;
  rules: SparringRules;
  ladder: Ladder;
}

export class Sparring {
  constructor(private readonly deps: SparringDeps) {}

  async candidates(today: string): Promise<SparringCandidate[]> {
    const report = await this.deps.notes.dueForReview(today);
    return [
      ...report.due.map((n) => ({
        path: n.path,
        title: n.title,
        reason: `due ${n.nextReview}, ${n.mastery}`,
      })),
      ...report.unsparred.map((n) => ({
        path: n.path,
        title: n.title,
        reason: 'never sparred',
      })),
    ];
  }

  async resolve(refs: string[]): Promise<string[]> {
    if (refs.every((r) => r.endsWith('.md'))) return refs;
    const byCoachId = await resourcesByCoachId(this.deps.notes);
    return refs.map((ref) => {
      if (ref.endsWith('.md')) return ref;
      const path = byCoachId.get(ref);
      if (!path)
        throw new NotFoundError(`No Resources note has coach_id ${ref}`);
      return path;
    });
  }

  async open(
    path: string,
  ): Promise<{ note: NoteDetails; conversation: SparringConversation }> {
    const note = await this.deps.notes.readNote(path);
    if (note.bucket !== 'resources') {
      throw new NotSparrableError(
        `${path}: only notes under 3.Resources can be sparred`,
      );
    }
    return {
      note,
      conversation: new SparringConversation(
        this.deps.partner,
        { title: note.title, body: note.body },
        this.deps.rules,
      ),
    };
  }

  async plan(sparred: SparredNote[], today: string): Promise<Tier1Plan> {
    const draft: SessionDraft = {
      tier: 1,
      date: today,
      items: sparred.map(({ note, result }) => ({
        note: note.coachId ? { coachId: note.coachId } : { path: note.path },
        challenge: result.challenge,
        answer: result.answer,
        verdict: result.verdict,
        gaps: result.gaps,
        nextReview: scheduleReview(
          {
            tier: 1,
            verdict: result.verdict,
            gaps: result.gaps.length,
            date: today,
            tier2History: tier2History(note),
          },
          this.deps.ladder,
        ).nextReview,
      })),
    };
    const preview = await this.deps.sessions.record(draft, false);
    return { draft, preview, titles: sparred.map((s) => s.note.title) };
  }

  async record(plan: Tier1Plan): Promise<RecordedSession> {
    const recorded = await this.deps.sessions.record(plan.draft, true);
    await this.deps.pending.add({
      sessionId: recorded.sessionId,
      date: plan.draft.date,
      coachIds: recorded.items.map((i) => i.coachId),
    });
    return recorded;
  }
}

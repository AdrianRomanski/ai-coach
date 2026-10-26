import {
  enforceVerdict,
  scheduleReview,
  sessionGaps,
  type Judgement,
  type Ladder,
} from '@ai-coach/domain';
import { NotFoundError, PayloadMismatchError } from '../errors.js';
import { resourcesByCoachId, tier2History } from '../history.js';
import type { Judge } from '../ports/models.js';
import type { PendingJudgements, PendingSession } from '../ports/state.js';
import type {
  NotesRepository,
  RecordedSession,
  SessionDraft,
  SessionLog,
} from '../ports/vault.js';

export interface JudgedNote {
  coachId: string;
  path: string;
  title: string;
  judgement: Judgement;
  gaps: string[];
  nextReview: string;
}

export interface JudgedSession {
  session: PendingSession;
  model: string;
  notes: JudgedNote[];
  missing: string[];
  draft: SessionDraft | null;
  preview: RecordedSession | null;
}

export interface JudgingDeps {
  notes: NotesRepository;
  sessions: SessionLog;
  pending: PendingJudgements;
  judge: Judge;
  ladder: Ladder;
  includeAssertions: boolean;
}

export class Judging {
  constructor(private readonly deps: JudgingDeps) {}

  waiting(): Promise<PendingSession[]> {
    return this.deps.pending.list();
  }

  async select(sessionIds: string[]): Promise<PendingSession[]> {
    const queue = await this.deps.pending.list();
    if (!sessionIds.length) return queue;
    return sessionIds.map((id) => {
      const found = queue.find((s) => s.sessionId === id);
      if (!found) throw new NotFoundError(`${id} is not waiting for judgement`);
      return found;
    });
  }

  async judge(session: PendingSession, today: string): Promise<JudgedSession> {
    const payload = await this.deps.sessions.tier2Payload(session.sessionId, {
      includeAssertions: this.deps.includeAssertions,
    });
    if (payload.items.length !== session.coachIds.length) {
      throw new PayloadMismatchError(
        `${session.sessionId} has ${payload.items.length} items but ${session.coachIds.length} notes were recorded for it`,
      );
    }
    const report = await this.deps.judge.judge({
      items: payload.items.map((item, i) => {
        const style = session.styles?.[session.coachIds[i]!];
        return style ? { ...item, style } : item;
      }),
    });
    if (report.items.length !== payload.items.length) {
      throw new PayloadMismatchError(
        `The judge returned ${report.items.length} judgements for ${payload.items.length} items`,
      );
    }

    const byCoachId = await resourcesByCoachId(this.deps.notes);
    const notes: JudgedNote[] = [];
    const missing: string[] = [];
    const draft: SessionDraft = { tier: 2, date: today, items: [] };
    for (const [i, coachId] of session.coachIds.entries()) {
      const path = byCoachId.get(coachId);
      if (!path) {
        missing.push(coachId);
        continue;
      }
      const note = await this.deps.notes.readNote(path);
      const judgement = enforceVerdict(report.items[i]!);
      const gaps = sessionGaps(judgement);
      const { nextReview } = scheduleReview(
        {
          tier: 2,
          verdict: judgement.verdict,
          gaps: gaps.length,
          date: today,
          tier2History: tier2History(note),
        },
        this.deps.ladder,
      );
      notes.push({
        coachId,
        path,
        title: note.title,
        judgement,
        gaps,
        nextReview,
      });
      draft.items.push({
        note: { coachId },
        challenge: payload.items[i]!.challenge,
        answer: payload.items[i]!.answer,
        verdict: judgement.verdict,
        gaps,
        nextReview,
      });
    }

    const preview = draft.items.length
      ? await this.deps.sessions.record(draft, false)
      : null;
    return {
      session,
      model: report.model,
      notes,
      missing,
      draft: draft.items.length ? draft : null,
      preview,
    };
  }

  async record(judged: JudgedSession): Promise<RecordedSession | null> {
    const recorded = judged.draft
      ? await this.deps.sessions.record(judged.draft, true)
      : null;
    await this.deps.pending.remove(judged.session.sessionId);
    return recorded;
  }
}

import {
  PARA_BUCKETS,
  tier2Payload,
  type Mastery,
  type ParaBucket,
  type Tier2Payload,
} from '@ai-coach/domain';
import { NotFoundError, VaultRefusedError } from '../lib/errors.js';
import type {
  Judge,
  JudgeReport,
  NextTurn,
  NextTurnRequest,
  ChallengeRequest,
  OpeningChallenge,
  SparringPartner,
} from '../lib/ports/models.js';
import type {
  Clock,
  PendingJudgements,
  PendingSession,
} from '../lib/ports/state.js';
import type {
  DueReport,
  FilingPlan,
  FilingRequest,
  NoteDetails,
  NoteListing,
  NotesRepository,
  NoteSummary,
  RecordedSession,
  SessionDraft,
  SessionEntry,
  SessionLog,
  VaultFiling,
  BookChapter,
  RawRole,
} from '../lib/ports/vault.js';

const FOLDERS: Record<string, ParaBucket> = {
  '0.Inbox': 'inbox',
  '1.Projects': 'projects',
  '2.Areas': 'areas',
  '3.Resources': 'resources',
  '4.Archive': 'archive',
};

interface StoredNote {
  path: string;
  title: string;
  body: string;
  coachId: string | null;
  rawRole: RawRole;
  chapter: BookChapter | null;
}

interface StoredSession {
  sessionId: string;
  tier: 1 | 2;
  date: string;
  items: {
    coachId: string;
    challenge: string;
    answer: string;
    verdict: 'pass' | 'fail';
    gaps: string[];
    nextReview: string;
  }[];
}

export class InMemoryVault implements NotesRepository, SessionLog, VaultFiling {
  readonly notes = new Map<string, StoredNote>();
  readonly sessions: StoredSession[] = [];
  private ids = 0;

  constructor(notes: Record<string, string> = {}) {
    for (const [path, body] of Object.entries(notes)) this.put(path, body);
  }

  put(
    path: string,
    body: string,
    raw: { rawRole: RawRole; chapter?: BookChapter } = { rawRole: null },
  ): void {
    const title = path.split('/').pop()!.replace(/\.md$/, '');
    this.notes.set(path, {
      path,
      title,
      body,
      coachId: null,
      rawRole: raw.rawRole,
      chapter: raw.chapter ?? null,
    });
  }

  private bucket(path: string): ParaBucket | null {
    return path.includes('/') ? (FOLDERS[path.split('/')[0]!] ?? null) : null;
  }

  private entries(coachId: string | null): SessionEntry[] {
    if (!coachId) return [];
    return this.sessions.flatMap((s) =>
      s.items
        .filter((i) => i.coachId === coachId)
        .map((i) => ({
          sessionId: s.sessionId,
          tier: s.tier,
          date: s.date,
          verdict: i.verdict,
          gaps: i.gaps,
          nextReview: i.nextReview,
        })),
    );
  }

  private summary(note: StoredNote): NoteSummary {
    const entries = this.entries(note.coachId);
    const latest = (tier: 1 | 2) =>
      entries.filter((e) => e.tier === tier).at(-1)?.verdict;
    const mastery: Mastery = !entries.length
      ? 'unsparred'
      : latest(2) === 'pass'
        ? 'tier2_passed'
        : latest(1) === 'pass'
          ? 'tier1_passed'
          : 'attempted';
    const parts = note.path.split('/');
    return {
      path: note.path,
      title: note.title,
      bucket: this.bucket(note.path),
      container: parts.length > 2 ? parts[1]! : null,
      coachId: note.coachId,
      mastery,
      nextReview: entries.at(-1)?.nextReview ?? null,
    };
  }

  async listNotes(
    filter: { bucket?: ParaBucket | 'out_of_place' } = {},
  ): Promise<NoteListing> {
    const all = [...this.notes.values()].map((n) => this.summary(n));
    const counts = Object.fromEntries(
      [...PARA_BUCKETS, 'out_of_place'].map((b) => [b, 0]),
    ) as NoteListing['counts'];
    for (const n of all) counts[n.bucket ?? 'out_of_place']++;
    return {
      counts,
      notes: all.filter(
        (n) => !filter.bucket || (n.bucket ?? 'out_of_place') === filter.bucket,
      ),
      invalidSessions: [],
    };
  }

  async readNote(path: string): Promise<NoteDetails> {
    const note = this.notes.get(path);
    if (!note) throw new VaultRefusedError(`Note not found: ${path}`);
    return {
      ...this.summary(note),
      body: note.body,
      sessions: this.entries(note.coachId),
      rawRole: note.rawRole,
      chapter: note.chapter,
    };
  }

  async dueForReview(today: string): Promise<DueReport> {
    const resources = [...this.notes.values()]
      .filter(
        (n) => this.bucket(n.path) === 'resources' && n.rawRole !== 'index',
      )
      .map((n) => this.summary(n));
    return {
      today,
      due: resources
        .filter((n) => n.coachId && n.nextReview && n.nextReview <= today)
        .map((n) => ({
          path: n.path,
          title: n.title,
          coachId: n.coachId!,
          nextReview: n.nextReview!,
          mastery: n.mastery,
        })),
      unsparred: resources
        .filter((n) => n.mastery === 'unsparred')
        .map((n) => ({ path: n.path, title: n.title })),
      orphaned: [],
      invalidSessions: [],
    };
  }

  async record(
    draft: SessionDraft,
    execute: boolean,
  ): Promise<RecordedSession> {
    const resolved = draft.items.map((item) => {
      const note =
        'path' in item.note
          ? this.notes.get(item.note.path)
          : [...this.notes.values()].find(
              (n) => n.coachId === (item.note as { coachId: string }).coachId,
            );
      if (!note || this.bucket(note.path) !== 'resources') {
        throw new VaultRefusedError(
          `record_session refused: ${JSON.stringify(item.note)} is not a Resources note`,
        );
      }
      return { item, note, coachId: note.coachId ?? `c-${++this.ids}` };
    });
    const sessionId = `s-${++this.ids}`;
    if (execute) {
      for (const r of resolved) r.note.coachId = r.coachId;
      this.sessions.push({
        sessionId,
        tier: draft.tier,
        date: draft.date,
        items: resolved.map(({ item, coachId }) => ({
          coachId,
          challenge: item.challenge,
          answer: item.answer,
          verdict: item.verdict,
          gaps: item.gaps,
          nextReview: item.nextReview,
        })),
      });
    }
    return {
      executed: execute,
      sessionId,
      items: resolved.map(({ item, note, coachId }) => ({
        notePath: note.path,
        coachId,
        verdict: item.verdict,
        nextReview: item.nextReview,
      })),
    };
  }

  async tier2Payload(sessionId: string): Promise<Tier2Payload> {
    const session = this.sessions.find((s) => s.sessionId === sessionId);
    if (!session)
      throw new VaultRefusedError(`Session not found: ${sessionId}`);
    return tier2Payload({
      items: session.items.map((i) => ({
        challenge: i.challenge,
        answer: i.answer,
      })),
    });
  }

  async plan(request: FilingRequest, execute: boolean): Promise<FilingPlan> {
    if (request.kind !== 'file')
      throw new NotFoundError(`InMemoryVault does not support ${request.kind}`);
    const to = `${request.to}/${request.path.split('/').pop()}`;
    if (execute) {
      const note = this.notes.get(request.path)!;
      this.notes.delete(request.path);
      this.notes.set(to, { ...note, path: to });
    }
    return {
      actions: [{ op: 'move', from: request.path, to }],
      collisions: [],
      warnings: [],
      executed: execute,
    };
  }
}

export class ScriptedPartner implements SparringPartner {
  readonly challengeRequests: ChallengeRequest[] = [];
  readonly turnRequests: NextTurnRequest[] = [];
  readonly challenges: (string | OpeningChallenge | Error)[] = [];
  readonly turns: (NextTurn | Error)[] = [];

  async openingChallenge(request: ChallengeRequest): Promise<OpeningChallenge> {
    this.challengeRequests.push(structuredClone(request));
    const next = this.challenges.shift();
    if (next === undefined)
      throw new Error('ScriptedPartner ran out of challenges');
    if (next instanceof Error) throw next;
    return typeof next === 'string'
      ? { focus: "The note's central idea.", challenge: next }
      : next;
  }

  async nextTurn(request: NextTurnRequest): Promise<NextTurn> {
    this.turnRequests.push(structuredClone(request));
    const next = this.turns.shift();
    if (next === undefined) throw new Error('ScriptedPartner ran out of turns');
    if (next instanceof Error) throw next;
    return next;
  }
}

export class ScriptedJudge implements Judge {
  readonly payloads: Tier2Payload[] = [];
  readonly reports: JudgeReport[] = [];

  async judge(payload: Tier2Payload): Promise<JudgeReport> {
    this.payloads.push(payload);
    const next = this.reports.shift();
    if (!next) throw new Error('ScriptedJudge ran out of reports');
    return next;
  }
}

export class InMemoryPending implements PendingJudgements {
  readonly sessions: PendingSession[] = [];

  async list(): Promise<PendingSession[]> {
    return this.sessions.map((s) => ({ ...s, coachIds: [...s.coachIds] }));
  }

  async add(session: PendingSession): Promise<void> {
    await this.remove(session.sessionId);
    this.sessions.push(session);
  }

  async remove(sessionId: string): Promise<void> {
    const i = this.sessions.findIndex((s) => s.sessionId === sessionId);
    if (i >= 0) this.sessions.splice(i, 1);
  }
}

export class FixedClock implements Clock {
  constructor(public date: string) {}

  today(): string {
    return this.date;
  }
}

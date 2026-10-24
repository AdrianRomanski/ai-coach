import type {
  Mastery,
  ParaBucket,
  Tier,
  Tier2Payload,
  Verdict,
} from '@ai-coach/domain';

export interface NoteSummary {
  path: string;
  title: string;
  bucket: ParaBucket | null;
  container: string | null;
  coachId: string | null;
  mastery: Mastery;
  nextReview: string | null;
}

export interface SessionEntry {
  sessionId: string;
  tier: Tier;
  date: string;
  verdict: Verdict;
  gaps: string[];
  nextReview: string;
}

export interface NoteDetails extends NoteSummary {
  body: string;
  sessions: SessionEntry[];
}

export interface InvalidSession {
  file: string;
  error: string;
}

export interface NoteListing {
  counts: Record<ParaBucket | 'out_of_place', number>;
  notes: NoteSummary[];
  invalidSessions: InvalidSession[];
}

export interface DueReport {
  today: string;
  due: {
    path: string;
    title: string;
    coachId: string;
    nextReview: string;
    mastery: Mastery;
  }[];
  unsparred: { path: string; title: string }[];
  orphaned: { coachId: string; lastSession: string | null }[];
  invalidSessions: InvalidSession[];
}

export interface NotesRepository {
  listNotes(filter?: {
    bucket?: ParaBucket | 'out_of_place';
  }): Promise<NoteListing>;
  readNote(path: string): Promise<NoteDetails>;
  dueForReview(today: string): Promise<DueReport>;
}

export type NoteRef = { path: string } | { coachId: string };

export interface SessionItemDraft {
  note: NoteRef;
  challenge: string;
  answer: string;
  verdict: Verdict;
  gaps: string[];
  nextReview: string;
}

export interface SessionDraft {
  tier: Tier;
  date: string;
  items: SessionItemDraft[];
}

export interface RecordedSession {
  executed: boolean;
  sessionId: string;
  items: {
    notePath: string;
    coachId: string;
    verdict: Verdict;
    nextReview: string;
  }[];
}

export interface SessionLog {
  record(draft: SessionDraft, execute: boolean): Promise<RecordedSession>;
  tier2Payload(sessionId: string): Promise<Tier2Payload>;
}

export type FilingAction =
  | { op: 'rename'; from: string; to: string }
  | { op: 'create'; to: string }
  | { op: 'move'; from: string; to: string }
  | { op: 'write'; to: string }
  | { op: 'remove_empty'; from: string };

export interface FilingPlan {
  actions: FilingAction[];
  collisions: string[];
  warnings: string[];
  executed: boolean;
}

export type FilingRequest =
  | { kind: 'file'; path: string; to: string }
  | { kind: 'capture'; title: string; body: string }
  | { kind: 'archive'; project: string }
  | { kind: 'init' };

export interface VaultFiling {
  plan(request: FilingRequest, execute: boolean): Promise<FilingPlan>;
}

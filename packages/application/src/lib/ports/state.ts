export interface PendingSession {
  sessionId: string;
  date: string;
  coachIds: string[];
}

export interface PendingJudgements {
  list(): Promise<PendingSession[]>;
  add(session: PendingSession): Promise<void>;
  remove(sessionId: string): Promise<void>;
}

export interface Clock {
  today(): string;
}

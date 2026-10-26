import type { CoachingStyle } from '@ai-coach/domain';

export interface PendingSession {
  sessionId: string;
  date: string;
  coachIds: string[];
  styles?: Record<string, CoachingStyle>;
}

export interface PendingJudgements {
  list(): Promise<PendingSession[]>;
  add(session: PendingSession): Promise<void>;
  remove(sessionId: string): Promise<void>;
}

export interface Clock {
  today(): string;
}

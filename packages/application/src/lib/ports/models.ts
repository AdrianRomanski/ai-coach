import type {
  Exchange,
  ItemJudgement,
  Note,
  SparringRules,
  Tier2Payload,
  Verdict,
} from '@ai-coach/domain';

export interface ChallengeRequest {
  note: Note;
  rules: SparringRules;
  rejected: string[];
}

export interface NextTurnRequest {
  note: Note;
  rules: SparringRules;
  exchanges: readonly Exchange[];
  followUpsLeft: number;
  rejected: string[];
}

export type NextTurn =
  | { action: 'probe'; question: string }
  | { action: 'conclude'; verdict: Verdict; gaps: string[]; feedback: string };

export interface SparringPartner {
  openingChallenge(request: ChallengeRequest): Promise<string>;
  nextTurn(request: NextTurnRequest): Promise<NextTurn>;
}

export interface JudgeReport {
  model: string;
  items: ItemJudgement[];
}

export interface Judge {
  judge(payload: Tier2Payload): Promise<JudgeReport>;
}

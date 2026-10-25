import type {
  CoachingStyle,
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
  style: CoachingStyle;
  assertions: string[];
  rejected: string[];
}

export interface OpeningChallenge {
  focus: string;
  scope: string[];
  jargon: string[];
  challenge: string;
}

export interface NextTurnRequest {
  note: Note;
  rules: SparringRules;
  style: CoachingStyle;
  focus: string;
  scope: readonly string[];
  exchanges: readonly Exchange[];
  followUpsLeft: number;
  rejected: string[];
}

export type NextTurn =
  | { action: 'probe'; question: string }
  | { action: 'conclude'; verdict: Verdict; gaps: string[]; feedback: string };

export interface SparringPartner {
  openingChallenge(request: ChallengeRequest): Promise<OpeningChallenge>;
  nextTurn(request: NextTurnRequest): Promise<NextTurn>;
}

export interface JudgeReport {
  model: string;
  items: ItemJudgement[];
}

export interface Judge {
  judge(payload: Tier2Payload): Promise<JudgeReport>;
}

export interface StudyRequest {
  note: Note;
  rules: SparringRules;
  style: CoachingStyle;
  assertions: string[];
  gap: string;
}

export interface StudyCheck {
  closed: boolean;
  nudge: string;
}

export interface StyleClassifier {
  classify(note: Note, rules: SparringRules): Promise<CoachingStyle>;
}

export interface StudyPartner {
  clue(request: StudyRequest): Promise<string>;
  hint(request: StudyRequest): Promise<string>;
  quote(request: StudyRequest): Promise<string>;
  check(request: StudyRequest & { explanation: string }): Promise<StudyCheck>;
}

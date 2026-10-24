import type { Verdict } from './vocabulary.js';

export const FALLACIES = [
  'circular_reasoning',
  'begging_the_question',
  'false_cause',
  'false_dichotomy',
  'hasty_generalization',
  'equivocation',
  'appeal_to_authority',
  'non_sequitur',
  'strawman',
  'slippery_slope',
  'composition_division',
  'tautology',
] as const;
export type Fallacy = (typeof FALLACIES)[number];

export const CLAIM_KINDS = ['mechanism', 'assertion', 'definition'] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

export interface Claim {
  text: string;
  kind: ClaimKind;
  supported: boolean;
  fallacies: Fallacy[];
  handWave: boolean;
}

export interface ItemJudgement {
  claims: Claim[];
  gaps: string[];
  verdict: Verdict;
  reason: string;
}

export interface Judgement extends ItemJudgement {
  modelVerdict: Verdict;
}

export function enforceVerdict(item: ItemJudgement): Judgement {
  const flawed = item.claims.some((c) => c.fallacies.length > 0 || c.handWave);
  const pass = item.verdict === 'pass' && !flawed && item.gaps.length === 0;
  return {
    ...item,
    modelVerdict: item.verdict,
    verdict: pass ? 'pass' : 'fail',
  };
}

function describeClaim(claim: Claim): string | null {
  const problems = [
    ...claim.fallacies.map((f) => f.replaceAll('_', ' ')),
    ...(claim.handWave ? ['hand-waving'] : []),
  ];
  return problems.length ? `${problems.join(', ')}: "${claim.text}"` : null;
}

export function sessionGaps(judgement: ItemJudgement): string[] {
  const flagged = judgement.claims
    .map(describeClaim)
    .filter((g): g is string => g !== null);
  return [...judgement.gaps, ...flagged];
}

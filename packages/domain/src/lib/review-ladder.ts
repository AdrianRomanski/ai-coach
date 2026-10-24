import { DomainError } from './errors.js';
import type { Tier, Verdict } from './vocabulary.js';

export interface Tier2Outcome {
  verdict: Verdict;
  gaps: number;
}

export interface Ladder {
  failDays: number;
  tier1PassDays: number;
  tier2PassDays: number[];
}

export const DEFAULT_LADDER: Ladder = {
  failDays: 1,
  tier1PassDays: 3,
  tier2PassDays: [7, 14, 30, 60, 120, 240, 365],
};

export interface ReviewInput {
  tier: Tier;
  verdict: Verdict;
  gaps: number;
  date: string;
  tier2History: Tier2Outcome[];
}

export interface Review {
  nextReview: string;
  intervalDays: number;
  rung: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(date: string): Date {
  const match = ISO_DATE.exec(date);
  const parsed = match
    ? new Date(
        Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
      )
    : null;
  if (!parsed || parsed.toISOString().slice(0, 10) !== date) {
    throw new DomainError(`Not a YYYY-MM-DD date: ${date}`);
  }
  return parsed;
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function validateLadder(ladder: Ladder): Ladder {
  const steps = [
    ladder.failDays,
    ladder.tier1PassDays,
    ...ladder.tier2PassDays,
  ];
  if (
    !ladder.tier2PassDays.length ||
    steps.some((d) => !Number.isInteger(d) || d < 1)
  ) {
    throw new DomainError(
      'Every ladder interval must be a whole number of days, at least 1',
    );
  }
  if (
    ladder.tier2PassDays.some(
      (d, i) => i > 0 && d <= ladder.tier2PassDays[i - 1]!,
    )
  ) {
    throw new DomainError('Tier 2 pass intervals must strictly increase');
  }
  return ladder;
}

function step(rung: number, outcome: Tier2Outcome, top: number): number {
  if (outcome.verdict === 'pass') return Math.min(rung + 1, top);
  return Math.max(-1, rung - Math.max(1, outcome.gaps));
}

export function ladderRung(
  tier2History: Tier2Outcome[],
  ladder: Ladder = DEFAULT_LADDER,
): number {
  const top = ladder.tier2PassDays.length - 1;
  return tier2History.reduce((rung, outcome) => step(rung, outcome, top), -1);
}

export function scheduleReview(
  input: ReviewInput,
  ladder: Ladder = DEFAULT_LADDER,
): Review {
  validateLadder(ladder);
  if (!Number.isInteger(input.gaps) || input.gaps < 0) {
    throw new DomainError(`gaps must be a whole number, got ${input.gaps}`);
  }
  const before = ladderRung(input.tier2History, ladder);

  if (input.tier === 1) {
    const intervalDays =
      input.verdict === 'pass' ? ladder.tier1PassDays : ladder.failDays;
    return {
      nextReview: addDays(input.date, intervalDays),
      intervalDays,
      rung: before,
    };
  }

  const rung = step(
    before,
    { verdict: input.verdict, gaps: input.gaps },
    ladder.tier2PassDays.length - 1,
  );
  const intervalDays =
    input.verdict === 'pass' ? ladder.tier2PassDays[rung]! : ladder.failDays;
  return { nextReview: addDays(input.date, intervalDays), intervalDays, rung };
}

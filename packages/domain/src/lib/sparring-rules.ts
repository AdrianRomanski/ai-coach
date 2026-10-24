import {
  COACHING_STYLES,
  isCoachingStyle,
  type CoachingStyle,
} from './coaching-style.js';
import { DomainError } from './errors.js';

export const DEFAULT_BUZZWORDS = [
  'synergy',
  'leverage',
  'paradigm',
  'paradigm shift',
  'best practice',
  'best practices',
  'scalable',
  'robust',
  'seamless',
  'seamlessly',
  'game-changer',
  'game changer',
  'cutting-edge',
  'next-gen',
  'blazing fast',
  'battle-tested',
  'out of the box',
  'under the hood',
  'magic',
  'magically',
  'just works',
  'industry standard',
  'enterprise-grade',
  'holistic',
  'streamline',
  'disruptive',
  'empower',
  'world-class',
];

export const NEUTRAL_PROBE =
  'Walk me through that again step by step, as if I had never heard of it. What happens first, and why?';

export interface SparringRules {
  buzzwords: string[];
  style: CoachingStyle | 'auto';
  socraticRules: string[];
  maxFollowUps: number;
  maxRephrases: number;
  verbatimRunWords: number;
  maxChallengeAttempts: number;
  language: string;
}

export const DEFAULT_SPARRING_RULES: SparringRules = {
  buzzwords: DEFAULT_BUZZWORDS,
  style: 'auto',
  socraticRules: [],
  maxFollowUps: 3,
  maxRephrases: 2,
  verbatimRunWords: 6,
  maxChallengeAttempts: 3,
  language: 'the language the note is written in',
};

function wholeNumber(
  name: string,
  value: number,
  min: number,
  max: number,
): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new DomainError(
      `${name} must be a whole number from ${min} to ${max}, got ${value}`,
    );
  }
}

export function sparringRules(
  overrides: Partial<SparringRules> = {},
): SparringRules {
  const rules = { ...DEFAULT_SPARRING_RULES, ...overrides };
  wholeNumber('maxFollowUps', rules.maxFollowUps, 0, 10);
  wholeNumber('maxRephrases', rules.maxRephrases, 0, 10);
  wholeNumber('verbatimRunWords', rules.verbatimRunWords, 3, 20);
  wholeNumber('maxChallengeAttempts', rules.maxChallengeAttempts, 1, 5);
  if (rules.buzzwords.some((b) => !b.trim())) {
    throw new DomainError('Buzzwords cannot be empty');
  }
  if (rules.style !== 'auto' && !isCoachingStyle(rules.style)) {
    throw new DomainError(
      `style must be auto or one of ${COACHING_STYLES.join(', ')}, got ${rules.style}`,
    );
  }
  if (rules.socraticRules.some((r) => !r.trim())) {
    throw new DomainError('Socratic rules cannot be empty');
  }
  if (!rules.language.trim()) throw new DomainError('language cannot be empty');
  return rules;
}

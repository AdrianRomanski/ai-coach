import { z } from 'zod';

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

export const DEFAULT_SOCRATIC_RULES = [
  'Ask exactly one question per turn.',
  'Never explain, summarise or hint at the answer.',
  'Demand the mechanism: how and why it works, step by step, not what it is called.',
  'When an answer uses a term, ask the learner to define it in plain words, as if to a newcomer.',
  'Probe the edges: what breaks, what the trade-off is, when it does not apply.',
  'Challenge vague or hand-waving claims by asking for a concrete example.',
];

export const SparringConfig = z.object({
  buzzwords: z.array(z.string().min(1)).default(DEFAULT_BUZZWORDS),
  rules: z.array(z.string().min(1)).default(DEFAULT_SOCRATIC_RULES),
  maxFollowUps: z.number().int().min(0).max(10).default(3),
  maxRephrases: z.number().int().min(0).max(10).default(2),
  verbatimRunWords: z.number().int().min(3).max(20).default(6),
  maxChallengeAttempts: z.number().int().min(1).max(5).default(3),
  language: z.string().min(1).default('the language the note is written in'),
});
export type SparringConfig = z.infer<typeof SparringConfig>;
export type SparringConfigInput = z.input<typeof SparringConfig>;

export function sparringConfig(
  input: SparringConfigInput = {},
): SparringConfig {
  return SparringConfig.parse(input);
}

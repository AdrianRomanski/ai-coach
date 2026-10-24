export type Verdict = 'pass' | 'fail';
export type Tier = 1 | 2;

export const PARA_BUCKETS = [
  'inbox',
  'projects',
  'areas',
  'resources',
  'archive',
] as const;
export type ParaBucket = (typeof PARA_BUCKETS)[number];

export type Mastery =
  'unsparred' | 'attempted' | 'tier1_passed' | 'tier2_passed';

export interface Note {
  title: string;
  body: string;
}

export interface Exchange {
  question: string;
  answer: string;
}

import type { Tier2Outcome } from '@ai-coach/scheduler';
import type { ReadNoteResult } from '@ai-coach/vault-client';

export function tier2History(note: ReadNoteResult): Tier2Outcome[] {
  return note.history.entries
    .filter((e) => e.tier === 2)
    .map((e) => ({ verdict: e.verdict, gaps: e.gaps.length }));
}

export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

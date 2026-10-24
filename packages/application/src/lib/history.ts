import type { Tier2Outcome } from '@ai-coach/domain';
import type { NoteDetails, NotesRepository } from './ports/vault.js';

export function tier2History(note: NoteDetails): Tier2Outcome[] {
  return note.sessions
    .filter((s) => s.tier === 2)
    .map((s) => ({ verdict: s.verdict, gaps: s.gaps.length }));
}

export async function resourcesByCoachId(
  notes: NotesRepository,
): Promise<Map<string, string>> {
  const { notes: resources } = await notes.listNotes({ bucket: 'resources' });
  return new Map(
    resources
      .filter((n) => n.coachId)
      .map((n) => [n.coachId!, n.path] as const),
  );
}

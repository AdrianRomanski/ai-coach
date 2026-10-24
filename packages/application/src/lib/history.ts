import type {
  CoachingStyle,
  SparringRules,
  Tier2Outcome,
} from '@ai-coach/domain';
import type { StyleClassifier } from './ports/models.js';
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

export async function resolveStyle(
  note: NoteDetails,
  rules: SparringRules,
  classifier: StyleClassifier,
  explicit?: CoachingStyle,
): Promise<CoachingStyle> {
  if (explicit) return explicit;
  if (note.style) return note.style;
  if (rules.style !== 'auto') return rules.style;
  return classifier.classify({ title: note.title, body: note.body }, rules);
}

import type {
  CoachingStyle,
  Note,
  Passage,
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

export interface Reference {
  note: Note;
  text: string;
  assertions: string[];
  buzzwords: string[];
  passages: Passage[];
}

function firstPage(pages: string | null): number | null {
  const match = pages ? /\d+/.exec(pages) : null;
  return match ? Number(match[0]) : null;
}

export function referenceOf(note: NoteDetails): Reference {
  if (!note.concept) {
    return {
      note: { title: note.title, body: note.body },
      text: note.body,
      assertions: [],
      buzzwords: [],
      passages: [],
    };
  }
  const passages = note.concept.passages
    .filter((p) => p.found)
    .map((p) => ({ text: p.quote, page: firstPage(p.pages) }));
  const text = [
    ...note.concept.assertions,
    ...passages.map((p) => p.text),
    note.body,
  ].join('\n\n');
  return {
    note: { title: note.title, body: text },
    text,
    assertions: note.concept.assertions,
    buzzwords: note.concept.buzzwords,
    passages,
  };
}

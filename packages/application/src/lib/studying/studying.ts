import {
  StudyRound,
  asksForHelp,
  findBuzzwords,
  locatePassage,
  quotedPassage,
  groundedIn,
  scorePassage,
  type CoachingStyle,
  type Note,
  type Passage,
  type SparringRules,
  type StudiedGap,
} from '@ai-coach/domain';
import {
  NotFoundError,
  NotSparrableError,
  UnusableReplyError,
} from '../errors.js';
import { resolveStyle, resourcesByCoachId } from '../history.js';
import type { StudyPartner, StyleClassifier } from '../ports/models.js';
import type {
  FilingRequest,
  NoteDetails,
  NotesRepository,
} from '../ports/vault.js';

export type GapPlace =
  | { kind: 'here' }
  | { kind: 'elsewhere'; chapter: string; passage: Passage | null }
  | { kind: 'outside' };

export interface StudyPrompt {
  gap: string;
  index: number;
  total: number;
  hint: string;
  place: GapPlace;
}

export interface Elsewhere {
  title: string;
  note: Note;
  passage: Passage | null;
}

export type FindElsewhere = (gap: string) => Promise<Elsewhere | null>;

export type StudyOutcome =
  | { kind: 'rephrase'; buzzwords: string[] }
  | { kind: 'closed'; next: StudyPrompt | null }
  | { kind: 'retry'; nudge: string; passage: Passage | null }
  | { kind: 'unresolved'; nudge: string; next: StudyPrompt | null }
  | { kind: 'help'; clue: string; passage: Passage | null };

export class StudySession {
  private readonly round: StudyRound;
  private source: Note;

  constructor(
    private readonly partner: StudyPartner,
    private readonly note: Note,
    private readonly rules: SparringRules,
    readonly style: CoachingStyle,
    gaps: string[],
    private readonly elsewhere: FindElsewhere = async () => null,
  ) {
    this.source = note;
    this.round = StudyRound.over(gaps);
  }

  get isFinished(): boolean {
    return this.round.isFinished;
  }

  get gaps(): readonly StudiedGap[] {
    return this.round.gaps;
  }

  start(): Promise<StudyPrompt | null> {
    return this.prompt();
  }

  skip(): Promise<StudyPrompt | null> {
    this.round.skip();
    return this.prompt();
  }

  async answer(text: string): Promise<StudyOutcome> {
    const current = this.round.current;
    if (!current) throw new NotFoundError('Every gap has been studied');
    const request = {
      note: this.source,
      rules: this.rules,
      style: this.style,
      gap: current.gap,
    };
    if (asksForHelp(text)) {
      const [clue, passage] = await Promise.all([
        this.safely(
          () => this.partner.clue(request),
          'Reread the passage below, then explain the gap in your own words.',
        ),
        this.passageFor(current.gap),
      ]);
      return { kind: 'help', clue, passage };
    }
    const buzzwords = findBuzzwords(text, this.rules.buzzwords);
    if (buzzwords.length) return { kind: 'rephrase', buzzwords };

    const check = await this.safely(
      () => this.partner.check({ ...request, explanation: text }),
      {
        closed: false,
        nudge:
          'The coach could not judge that answer; try saying it another way.',
      },
    );
    const progress = this.round.record(text, check.closed);
    if (progress === 'closed')
      return { kind: 'closed', next: await this.prompt() };
    if (progress === 'unresolved') {
      return {
        kind: 'unresolved',
        nudge: check.nudge,
        next: await this.prompt(),
      };
    }
    return {
      kind: 'retry',
      nudge: check.nudge,
      passage: await this.passageFor(current.gap),
    };
  }

  private async safely<T>(attempt: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await attempt();
    } catch (err) {
      if (err instanceof UnusableReplyError) return fallback;
      throw err;
    }
  }

  private async passageFor(gap: string): Promise<Passage | null> {
    const quote = await this.safely(
      () =>
        this.partner.quote({
          note: this.source,
          rules: this.rules,
          style: this.style,
          gap,
        }),
      '',
    );
    return (
      quotedPassage(this.source.body, quote) ??
      locatePassage(this.source.body, `${quote} ${gap}`)
    );
  }

  private async prompt(): Promise<StudyPrompt | null> {
    const current = this.round.current;
    if (!current) return null;
    const place = await this.place(current.gap);
    const hint = await this.safely(
      () =>
        this.partner.hint({
          note: this.source,
          rules: this.rules,
          style: this.style,
          gap: current.gap,
        }),
      'How would you explain this point in your own words?',
    );
    return { gap: current.gap, ...this.round.position, hint, place };
  }

  private async place(gap: string): Promise<GapPlace> {
    this.source = this.note;
    if (groundedIn(this.note.body, gap)) return { kind: 'here' };
    const found = await this.elsewhere(gap);
    if (!found) return { kind: 'outside' };
    this.source = found.note;
    return { kind: 'elsewhere', chapter: found.title, passage: found.passage };
  }
}

export interface StudyingDeps {
  notes: NotesRepository;
  partner: StudyPartner;
  classifier: StyleClassifier;
  rules: SparringRules;
}

export class Studying {
  constructor(private readonly deps: StudyingDeps) {}

  async resolve(ref: string): Promise<string> {
    if (ref.endsWith('.md')) return ref;
    const path = (await resourcesByCoachId(this.deps.notes)).get(ref);
    if (!path) throw new NotFoundError(`No Resources note has coach_id ${ref}`);
    return path;
  }

  async open(
    path: string,
    style?: CoachingStyle,
  ): Promise<{ note: NoteDetails; session: StudySession }> {
    const note = await this.deps.notes.readNote(path);
    if (note.rawRole === 'index') {
      throw new NotSparrableError(
        `${path} is a book's index: study one of its chapters instead`,
      );
    }
    const latest = note.sessions.at(-1);
    if (!latest || latest.verdict !== 'fail' || !latest.gaps.length) {
      throw new NotFoundError(
        `${note.title} has no gaps to study: its latest session is not a failure with gaps`,
      );
    }
    return {
      note,
      session: new StudySession(
        this.deps.partner,
        { title: note.title, body: note.body },
        this.deps.rules,
        await resolveStyle(note, this.deps.rules, this.deps.classifier, style),
        latest.gaps,
        note.chapter ? this.siblingSearch(note) : undefined,
      ),
    };
  }

  private siblingSearch(note: NoteDetails): FindElsewhere {
    const folder = note.path.slice(0, note.path.lastIndexOf('/') + 1);
    let chapters: Promise<Map<string, NoteDetails[]>> | null = null;
    const load = async () => {
      const { notes } = await this.deps.notes.listNotes({
        bucket: 'resources',
      });
      const paths = notes
        .map((n) => n.path)
        .filter(
          (p) =>
            p !== note.path &&
            p.startsWith(folder) &&
            !p.slice(folder.length).includes('/'),
        );
      const grouped = new Map<string, NoteDetails[]>();
      for (const sibling of await Promise.all(
        paths.map((p) => this.deps.notes.readNote(p)),
      )) {
        const title = sibling.title.replace(/\s*\(\d+ of \d+\)\s*$/, '');
        grouped.set(title, [...(grouped.get(title) ?? []), sibling]);
      }
      return grouped;
    };
    return async (gap) => {
      chapters ??= load();
      const grouped = await chapters;
      const titles = [...grouped.keys()];
      if (!titles.length) return null;

      const candidates = titles
        .flatMap((title) =>
          grouped.get(title)!.map((part) => ({
            title,
            part,
            scored: scorePassage(part.body, gap),
          })),
        )
        .filter((c) => c.scored)
        .sort((a, b) => b.scored!.score - a.scored!.score)
        .filter((c, i, all) => all.findIndex((o) => o.title === c.title) === i)
        .slice(0, 3);

      if (candidates.length) {
        const choice = await this.deps.partner.chooseChapter({
          rules: this.deps.rules,
          gap,
          chapters: candidates.map(
            (c) => `${c.title}: ${c.scored!.passage.text}`,
          ),
        });
        const chosen = candidates[choice ?? 0]!;
        return {
          title: chosen.title,
          note: { title: chosen.part.title, body: chosen.scored!.passage.text },
          passage: chosen.scored!.passage,
        };
      }

      const choice = await this.deps.partner.chooseChapter({
        rules: this.deps.rules,
        gap,
        chapters: titles,
      });
      if (choice === null || !titles[choice]) return null;
      const part = grouped.get(titles[choice])![0]!;
      return {
        title: titles[choice],
        note: { title: part.title, body: part.body },
        passage: null,
      };
    };
  }

  explanationsNote(
    note: NoteDetails,
    session: StudySession,
    today: string,
  ): FilingRequest | null {
    const explained = session.gaps.filter((g) => g.explanation);
    if (!explained.length) return null;
    const source = note.path.replace(/\.md$/, '');
    const sections = explained.map(
      (g) =>
        `## ${g.gap}\n\n${g.explanation}${g.status === 'unresolved' ? '\n\n_Still open: reread the source and try again._' : ''}`,
    );
    return {
      kind: 'capture',
      title: `${note.title} - in my words`,
      body:
        [
          `Studied on ${today} from [[${source}|${note.title}]].`,
          ...sections,
        ].join('\n\n') + '\n',
    };
  }
}

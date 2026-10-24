import {
  StudyRound,
  findBuzzwords,
  locatePassage,
  quotedPassage,
  type Note,
  type Passage,
  type SparringRules,
  type StudiedGap,
} from '@ai-coach/domain';
import { NotFoundError, NotSparrableError } from '../errors.js';
import { resourcesByCoachId } from '../history.js';
import type { StudyPartner } from '../ports/models.js';
import type {
  FilingRequest,
  NoteDetails,
  NotesRepository,
} from '../ports/vault.js';

export interface StudyPrompt {
  gap: string;
  index: number;
  total: number;
  hint: string;
}

export type StudyOutcome =
  | { kind: 'rephrase'; buzzwords: string[] }
  | { kind: 'closed'; next: StudyPrompt | null }
  | { kind: 'retry'; nudge: string; passage: Passage | null }
  | { kind: 'unresolved'; nudge: string; next: StudyPrompt | null };

export class StudySession {
  private readonly round: StudyRound;

  constructor(
    private readonly partner: StudyPartner,
    private readonly note: Note,
    private readonly rules: SparringRules,
    gaps: string[],
  ) {
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
    const buzzwords = findBuzzwords(text, this.rules.buzzwords);
    if (buzzwords.length) return { kind: 'rephrase', buzzwords };

    const request = { note: this.note, rules: this.rules, gap: current.gap };
    const check = await this.partner.check({ ...request, explanation: text });
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
    const quote = await this.partner.quote(request);
    return {
      kind: 'retry',
      nudge: check.nudge,
      passage:
        quotedPassage(this.note.body, quote) ??
        locatePassage(this.note.body, `${quote} ${current.gap}`),
    };
  }

  private async prompt(): Promise<StudyPrompt | null> {
    const current = this.round.current;
    if (!current) return null;
    const hint = await this.partner.hint({
      note: this.note,
      rules: this.rules,
      gap: current.gap,
    });
    return { gap: current.gap, ...this.round.position, hint };
  }
}

export interface StudyingDeps {
  notes: NotesRepository;
  partner: StudyPartner;
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
        latest.gaps,
      ),
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

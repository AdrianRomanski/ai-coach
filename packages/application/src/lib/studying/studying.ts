import {
  StudyRound,
  asksForHelp,
  bestQuote,
  findBuzzwords,
  groundedIn,
  locatePassage,
  quotedPassage,
  scorePassage,
  type CoachingStyle,
  type Passage,
  type SparringRules,
  type StudiedGap,
} from '@ai-coach/domain';
import {
  NotFoundError,
  NotSparrableError,
  UnusableReplyError,
  VaultRefusedError,
} from '../errors.js';
import {
  referenceOf,
  resolveStyle,
  resourcesByCoachId,
  type Reference,
} from '../history.js';
import type { StudyPartner, StyleClassifier } from '../ports/models.js';
import type {
  FilingRequest,
  NoteDetails,
  NotesRepository,
} from '../ports/vault.js';

export type GapPlace = { kind: 'here' } | { kind: 'outside' };

export interface StudyPrompt {
  gap: string;
  index: number;
  total: number;
  hint: string;
  place: GapPlace;
}

export type StudyOutcome =
  | { kind: 'rephrase'; buzzwords: string[] }
  | { kind: 'closed'; next: StudyPrompt | null }
  | { kind: 'retry'; nudge: string; passage: Passage | null }
  | { kind: 'unresolved'; nudge: string; next: StudyPrompt | null }
  | { kind: 'help'; clue: string; passage: Passage | null };

export type SourceReader = (path: string) => Promise<string>;

export class StudySession {
  private readonly round: StudyRound;
  private readonly shown = new Set<string>();
  private readonly bodies = new Map<string, string | null>();

  constructor(
    private readonly partner: StudyPartner,
    private readonly reference: Reference,
    private readonly rules: SparringRules,
    readonly style: CoachingStyle,
    gaps: string[],
    private readonly readSource: SourceReader = async () => '',
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
    const request = this.request(current.gap);
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

  private request(gap: string) {
    return {
      note: this.reference.note,
      rules: this.rules,
      style: this.style,
      assertions: this.reference.assertions,
      gap,
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
    const quoted = bestQuote(this.reference.passages, gap, this.shown);
    if (quoted) return this.show(quoted);
    for (const source of this.reference.sources) {
      const body = await this.source(source);
      const found = body && scorePassage(body, gap, 70, this.shown);
      if (found) return this.show(found.passage);
    }
    if (this.reference.passages.length) return null;
    const quote = await this.safely(
      () => this.partner.quote(this.request(gap)),
      '',
    );
    const body = this.reference.note.body;
    const passage =
      quotedPassage(body, quote) ?? locatePassage(body, `${quote} ${gap}`);
    return passage && !this.shown.has(passage.text) ? this.show(passage) : null;
  }

  private show(passage: Passage): Passage {
    this.shown.add(passage.text);
    return passage;
  }

  private async source(path: string): Promise<string | null> {
    if (!this.bodies.has(path)) {
      try {
        this.bodies.set(path, await this.readSource(path));
      } catch (err) {
        if (!(err instanceof VaultRefusedError)) throw err;
        this.bodies.set(path, null);
      }
    }
    return this.bodies.get(path) ?? null;
  }

  private async prompt(): Promise<StudyPrompt | null> {
    const current = this.round.current;
    if (!current) return null;
    const place: GapPlace = groundedIn(this.reference.text, current.gap)
      ? { kind: 'here' }
      : { kind: 'outside' };
    const hint = await this.safely(
      () => this.partner.hint(this.request(current.gap)),
      'How would you explain this point in your own words?',
    );
    return { gap: current.gap, ...this.round.position, hint, place };
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
        `${path} is a book's index: study a concept note that quotes it instead`,
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
        referenceOf(note),
        this.deps.rules,
        await resolveStyle(note, this.deps.rules, this.deps.classifier, style),
        latest.gaps,
        async (source) => (await this.deps.notes.readNote(source)).body,
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

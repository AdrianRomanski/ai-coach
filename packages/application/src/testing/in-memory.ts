import {
  PARA_BUCKETS,
  type ConceptDraft,
  type Exchange,
  type MaterialItem,
  type CoachingStyle,
  type Note,
  type SparringRules,
  tier2Payload,
  type Mastery,
  type ParaBucket,
  type Tier2Payload,
} from '@ai-coach/domain';
import {
  NotFoundError,
  UnusableReplyError,
  VaultRefusedError,
} from '../lib/errors.js';
import type {
  Judge,
  JudgeReport,
  NextTurn,
  NextTurnRequest,
  ChallengeRequest,
  OpeningChallenge,
  StudyCheck,
  StudyPartner,
  StudyRequest,
  StyleClassifier,
  SparringPartner,
} from '../lib/ports/models.js';
import type {
  BookProgress,
  ConceptCheck,
  DistillPartner,
  IdeaProposal,
  Library,
  PassageHit,
} from '../lib/ports/library.js';
import type {
  Clock,
  PendingJudgements,
  PendingSession,
} from '../lib/ports/state.js';
import type {
  DueReport,
  FilingPlan,
  FilingRequest,
  NoteDetails,
  NoteListing,
  NotesRepository,
  NoteSummary,
  RecordedSession,
  SessionDraft,
  SessionEntry,
  SessionLog,
  VaultFiling,
  BookChapter,
  ConceptDetails,
  RawRole,
} from '../lib/ports/vault.js';

const FOLDERS: Record<string, ParaBucket> = {
  '0.Inbox': 'inbox',
  '1.Projects': 'projects',
  '2.Areas': 'areas',
  '3.Resources': 'resources',
  '4.Archive': 'archive',
};

interface StoredNote {
  path: string;
  title: string;
  body: string;
  coachId: string | null;
  raw: boolean;
  rawRole: RawRole;
  chapter: BookChapter | null;
  concept: ConceptDetails | null;
  style: CoachingStyle | null;
}

interface StoredSession {
  sessionId: string;
  tier: 1 | 2;
  date: string;
  items: {
    coachId: string;
    challenge: string;
    answer: string;
    verdict: 'pass' | 'fail';
    gaps: string[];
    nextReview: string;
  }[];
}

export class InMemoryVault implements NotesRepository, SessionLog, VaultFiling {
  readonly notes = new Map<string, StoredNote>();
  readonly sessions: StoredSession[] = [];
  private ids = 0;

  constructor(notes: Record<string, string> = {}) {
    for (const [path, body] of Object.entries(notes)) this.put(path, body);
  }

  put(
    path: string,
    body: string,
    raw: {
      rawRole: RawRole;
      chapter?: BookChapter;
      style?: CoachingStyle;
      concept?: ConceptDetails;
      raw?: boolean;
    } = {
      rawRole: null,
    },
  ): void {
    const title = path.split('/').pop()!.replace(/\.md$/, '');
    this.notes.set(path, {
      path,
      title,
      body,
      coachId: null,
      rawRole: raw.rawRole,
      raw: raw.raw ?? path.includes('/0.Raw/'),
      chapter: raw.chapter ?? null,
      concept: raw.concept ?? null,
      style: raw.style ?? null,
    });
  }

  private bucket(path: string): ParaBucket | null {
    return path.includes('/') ? (FOLDERS[path.split('/')[0]!] ?? null) : null;
  }

  private entries(coachId: string | null): SessionEntry[] {
    if (!coachId) return [];
    return this.sessions.flatMap((s) =>
      s.items
        .filter((i) => i.coachId === coachId)
        .map((i) => ({
          sessionId: s.sessionId,
          tier: s.tier,
          date: s.date,
          verdict: i.verdict,
          gaps: i.gaps,
          nextReview: i.nextReview,
        })),
    );
  }

  private summary(note: StoredNote): NoteSummary {
    const entries = this.entries(note.coachId);
    const latest = (tier: 1 | 2) =>
      entries.filter((e) => e.tier === tier).at(-1)?.verdict;
    const mastery: Mastery = !entries.length
      ? 'unsparred'
      : latest(2) === 'pass'
        ? 'tier2_passed'
        : latest(1) === 'pass'
          ? 'tier1_passed'
          : 'attempted';
    const parts = note.path.split('/');
    return {
      path: note.path,
      title: note.title,
      bucket: this.bucket(note.path),
      container: parts.length > 2 ? parts[1]! : null,
      coachId: note.coachId,
      mastery,
      nextReview: entries.at(-1)?.nextReview ?? null,
    };
  }

  async listNotes(
    filter: { bucket?: ParaBucket | 'out_of_place' } = {},
  ): Promise<NoteListing> {
    const all = [...this.notes.values()].map((n) => this.summary(n));
    const counts = Object.fromEntries(
      [...PARA_BUCKETS, 'out_of_place'].map((b) => [b, 0]),
    ) as NoteListing['counts'];
    for (const n of all) counts[n.bucket ?? 'out_of_place']++;
    return {
      counts,
      notes: all.filter(
        (n) => !filter.bucket || (n.bucket ?? 'out_of_place') === filter.bucket,
      ),
      invalidSessions: [],
    };
  }

  async readNote(path: string): Promise<NoteDetails> {
    const note = this.notes.get(path);
    if (!note) throw new VaultRefusedError(`Note not found: ${path}`);
    return {
      ...this.summary(note),
      body: note.body,
      sessions: this.entries(note.coachId),
      raw: note.raw,
      rawRole: note.rawRole,
      chapter: note.chapter,
      concept: note.concept,
      style: note.style,
    };
  }

  async dueForReview(today: string): Promise<DueReport> {
    const resources = [...this.notes.values()]
      .filter((n) => this.bucket(n.path) === 'resources' && !n.raw)
      .map((n) => this.summary(n));
    return {
      today,
      due: resources
        .filter((n) => n.coachId && n.nextReview && n.nextReview <= today)
        .map((n) => ({
          path: n.path,
          title: n.title,
          coachId: n.coachId!,
          nextReview: n.nextReview!,
          mastery: n.mastery,
        })),
      unsparred: resources
        .filter((n) => n.mastery === 'unsparred')
        .map((n) => ({ path: n.path, title: n.title })),
      orphaned: [],
      invalidSessions: [],
    };
  }

  async record(
    draft: SessionDraft,
    execute: boolean,
  ): Promise<RecordedSession> {
    const resolved = draft.items.map((item) => {
      const note =
        'path' in item.note
          ? this.notes.get(item.note.path)
          : [...this.notes.values()].find(
              (n) => n.coachId === (item.note as { coachId: string }).coachId,
            );
      if (!note || this.bucket(note.path) !== 'resources') {
        throw new VaultRefusedError(
          `record_session refused: ${JSON.stringify(item.note)} is not a Resources note`,
        );
      }
      return { item, note, coachId: note.coachId ?? `c-${++this.ids}` };
    });
    const sessionId = `s-${++this.ids}`;
    if (execute) {
      for (const r of resolved) r.note.coachId = r.coachId;
      this.sessions.push({
        sessionId,
        tier: draft.tier,
        date: draft.date,
        items: resolved.map(({ item, coachId }) => ({
          coachId,
          challenge: item.challenge,
          answer: item.answer,
          verdict: item.verdict,
          gaps: item.gaps,
          nextReview: item.nextReview,
        })),
      });
    }
    return {
      executed: execute,
      sessionId,
      items: resolved.map(({ item, note, coachId }) => ({
        notePath: note.path,
        coachId,
        verdict: item.verdict,
        nextReview: item.nextReview,
      })),
    };
  }

  async tier2Payload(
    sessionId: string,
    options: { includeAssertions?: boolean } = {},
  ): Promise<Tier2Payload> {
    const session = this.sessions.find((s) => s.sessionId === sessionId);
    if (!session)
      throw new VaultRefusedError(`Session not found: ${sessionId}`);
    const include = options.includeAssertions === true;
    const byCoachId = new Map(
      [...this.notes.values()].map((n) => [
        n.coachId,
        n.concept?.assertions ?? [],
      ]),
    );
    return tier2Payload(
      {
        items: session.items.map((i) => ({
          challenge: i.challenge,
          answer: i.answer,
          ...(include
            ? { coreAssertions: byCoachId.get(i.coachId) ?? [] }
            : {}),
        })),
      },
      { allowAssertions: include },
    );
  }

  async plan(request: FilingRequest, execute: boolean): Promise<FilingPlan> {
    if (request.kind !== 'file')
      throw new NotFoundError(`InMemoryVault does not support ${request.kind}`);
    const to = `${request.to}/${request.path.split('/').pop()}`;
    if (execute) {
      const note = this.notes.get(request.path)!;
      this.notes.delete(request.path);
      this.notes.set(to, { ...note, path: to });
    }
    return {
      actions: [{ op: 'move', from: request.path, to }],
      collisions: [],
      warnings: [],
      executed: execute,
    };
  }
}

export class ScriptedPartner implements SparringPartner {
  readonly challengeRequests: ChallengeRequest[] = [];
  readonly turnRequests: NextTurnRequest[] = [];
  readonly challenges: (string | OpeningChallenge | Error)[] = [];
  readonly turns: (NextTurn | Error)[] = [];

  async openingChallenge(request: ChallengeRequest): Promise<OpeningChallenge> {
    this.challengeRequests.push(structuredClone(request));
    const next = this.challenges.shift();
    if (next === undefined)
      throw new Error('ScriptedPartner ran out of challenges');
    if (next instanceof Error) throw next;
    return typeof next === 'string'
      ? {
          focus: "The note's central idea.",
          scope: [],
          jargon: [],
          challenge: next,
        }
      : next;
  }

  async nextTurn(request: NextTurnRequest): Promise<NextTurn> {
    this.turnRequests.push(structuredClone(request));
    const next = this.turns.shift();
    if (next === undefined) throw new Error('ScriptedPartner ran out of turns');
    if (next instanceof Error) throw next;
    return next;
  }
}

export class ScriptedJudge implements Judge {
  readonly payloads: Tier2Payload[] = [];
  readonly reports: JudgeReport[] = [];

  async judge(payload: Tier2Payload): Promise<JudgeReport> {
    this.payloads.push(payload);
    const next = this.reports.shift();
    if (!next) throw new Error('ScriptedJudge ran out of reports');
    return next;
  }
}

export class InMemoryPending implements PendingJudgements {
  readonly sessions: PendingSession[] = [];

  async list(): Promise<PendingSession[]> {
    return this.sessions.map((s) => ({ ...s, coachIds: [...s.coachIds] }));
  }

  async add(session: PendingSession): Promise<void> {
    await this.remove(session.sessionId);
    this.sessions.push(session);
  }

  async remove(sessionId: string): Promise<void> {
    const i = this.sessions.findIndex((s) => s.sessionId === sessionId);
    if (i >= 0) this.sessions.splice(i, 1);
  }
}

export class FixedClock implements Clock {
  constructor(public date: string) {}

  today(): string {
    return this.date;
  }
}

export class ScriptedStudyPartner implements StudyPartner {
  readonly hints: string[] = [];
  readonly quotes: string[] = [];
  readonly checks: StudyCheck[] = [];
  readonly checked: string[] = [];

  readonly hintedFrom: string[] = [];
  readonly failing = new Set<string>();
  readonly requests: StudyRequest[] = [];
  readonly styles: string[] = [];

  async clue(request: StudyRequest): Promise<string> {
    if (this.failing.has('clue'))
      throw new UnusableReplyError('study partner', 'unusable');
    this.styles.push(request.style);
    return `Clue for ${request.gap}`;
  }

  async hint(request: StudyRequest): Promise<string> {
    if (this.failing.has('hint'))
      throw new UnusableReplyError('study partner', 'unusable');
    this.hintedFrom.push(request.note.title);
    return this.hints.shift() ?? `Hint about ${request.gap}?`;
  }

  async quote(_request: StudyRequest): Promise<string> {
    return this.quotes.shift() ?? '';
  }

  async check(
    request: StudyRequest & { explanation: string },
  ): Promise<StudyCheck> {
    this.requests.push(request);
    if (this.failing.has('check'))
      throw new UnusableReplyError('study partner', 'unusable');
    this.checked.push(request.explanation);
    const next = this.checks.shift();
    if (!next) throw new Error('ScriptedStudyPartner ran out of checks');
    return next;
  }
}

export class FixedClassifier implements StyleClassifier {
  readonly classified: string[] = [];

  constructor(private readonly style: CoachingStyle = 'feynman') {}

  async classify(note: Note, _rules: SparringRules): Promise<CoachingStyle> {
    this.classified.push(note.title);
    return this.style;
  }
}

export class InMemoryLibrary implements Library {
  readonly created: ConceptDraft[] = [];
  readonly searches: { query: string; within?: string }[] = [];

  constructor(
    private readonly vault: InMemoryVault,
    readonly books: BookProgress[] = [],
    readonly hits: PassageHit[] = [],
  ) {}

  async readingProgress(book?: string): Promise<BookProgress[]> {
    return this.books.filter((b) => !book || b.folder === book);
  }

  async findPassages(
    query: string,
    options: { within?: string; limit?: number } = {},
  ): Promise<PassageHit[]> {
    this.searches.push({ query, within: options.within });
    return this.hits
      .filter((h) => !options.within || h.note.startsWith(options.within))
      .slice(0, options.limit ?? 10);
  }

  async createConcept(
    draft: ConceptDraft,
    execute: boolean,
  ): Promise<ConceptCheck> {
    const fold = (text: string) =>
      text
        .replace(/==|\*\*|__/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
    const path = `3.Resources/Concepts/${draft.title}.md`;
    const passages = draft.passages.map((p) => {
      const body = this.vault.notes.get(p.note)?.body;
      const found = !!body && fold(body).includes(fold(p.quote));
      return {
        note: p.note,
        quote: p.quote,
        pages: p.pages ?? null,
        found,
        problem: found ? null : 'not found in the note',
      };
    });
    if (passages.some((p) => !p.found)) {
      throw new VaultRefusedError(
        'create_concept refused: a quote was not found',
      );
    }
    const collisions = this.vault.notes.has(path) ? [path] : [];
    const executed = execute && !collisions.length;
    if (executed) {
      this.created.push(draft);
      this.vault.put(path, draft.summary, {
        rawRole: null,
        concept: {
          assertions: draft.assertions,
          buzzwords: draft.buzzwords,
          passages: draft.passages.map((p) => ({
            note: p.note,
            quote: p.quote,
            pages: p.pages ?? null,
            found: true,
          })),
          problems: [],
        },
      });
    }
    return { path, collisions, passages, executed };
  }
}

export class ScriptedDistillPartner implements DistillPartner {
  ideas: IdeaProposal[] | Error = [];
  questions: string[] | Error = [];
  assertions: string[] | Error = [];
  buzzwords: string[] | Error = [];
  readonly seen: { summary?: string; answers?: readonly Exchange[] }[] = [];

  private reply<T>(value: T | Error): T {
    if (value instanceof Error) throw value;
    return value;
  }

  async proposeIdeas(_request: {
    material: readonly MaterialItem[];
  }): Promise<IdeaProposal[]> {
    return this.reply(this.ideas);
  }

  async gapQuestions(request: { summary: string }): Promise<string[]> {
    this.seen.push({ summary: request.summary });
    return this.reply(this.questions);
  }

  async draftAssertions(request: {
    summary: string;
    answers: readonly Exchange[];
  }): Promise<string[]> {
    this.seen.push({ summary: request.summary, answers: request.answers });
    return this.reply(this.assertions);
  }

  async suggestBuzzwords(_request: { title: string }): Promise<string[]> {
    return this.reply(this.buzzwords);
  }
}

export const unusable = (): UnusableReplyError =>
  new UnusableReplyError('model', 'scripted unusable reply');

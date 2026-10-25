import { ChallengeQuotesNoteError, SparringRoundError } from './errors.js';
import type { SparringRules } from './sparring-rules.js';
import { findBuzzwords, quotesSource } from './text.js';
import type { Exchange, Note, Verdict } from './vocabulary.js';

export type Submission =
  | { kind: 'rephrase'; question: string; buzzwords: string[] }
  | { kind: 'accepted' };

export interface Conclusion {
  verdict: Verdict;
  gaps: string[];
  feedback: string;
}

export interface SparringResult {
  challenge: string;
  answer: string;
  verdict: Verdict;
  gaps: string[];
  exchanges: Exchange[];
}

export class SparringRound {
  private readonly exchanges: Exchange[] = [];
  private readonly buzzwordsUsed = new Set<string>();
  private pending: string | null = null;
  private opened = false;
  private rephrasesLeft: number;
  private conclusion: Conclusion | null = null;

  private constructor(
    readonly note: Note,
    readonly rules: SparringRules,
  ) {
    this.rephrasesLeft = rules.maxRephrases;
  }

  static over(note: Note, rules: SparringRules): SparringRound {
    return new SparringRound(note, rules);
  }

  quotesNote(text: string): boolean {
    return quotesSource(text, this.note.body, this.rules.verbatimRunWords);
  }

  open(challenge: string): void {
    if (this.opened) throw new SparringRoundError('The round is already open');
    const question = challenge.trim();
    if (!question) throw new SparringRoundError('A challenge cannot be empty');
    if (this.quotesNote(question)) {
      throw new ChallengeQuotesNoteError('The challenge quotes the note');
    }
    this.opened = true;
    this.pending = question;
  }

  get pendingQuestion(): string | null {
    return this.pending;
  }

  get transcript(): readonly Exchange[] {
    return this.exchanges.map((e) => ({ ...e }));
  }

  get followUpsLeft(): number {
    return Math.max(0, this.rules.maxFollowUps - (this.exchanges.length - 1));
  }

  get isConcluded(): boolean {
    return this.conclusion !== null;
  }

  submit(text: string): Submission {
    if (this.conclusion)
      throw new SparringRoundError('The round has concluded');
    if (!this.pending)
      throw new SparringRoundError('There is no question to answer');
    const answer = text.trim();
    if (!answer) throw new SparringRoundError('An answer cannot be empty');

    const buzzwords = findBuzzwords(answer, this.rules.buzzwords);
    buzzwords.forEach((b) => this.buzzwordsUsed.add(b));
    if (buzzwords.length && this.rephrasesLeft > 0) {
      this.rephrasesLeft--;
      return { kind: 'rephrase', question: this.pending, buzzwords };
    }

    this.exchanges.push({ question: this.pending, answer });
    this.pending = null;
    this.rephrasesLeft = this.rules.maxRephrases;
    return { kind: 'accepted' };
  }

  withdrawLastAnswer(): void {
    if (this.pending || this.conclusion || !this.exchanges.length) {
      throw new SparringRoundError('There is no accepted answer to withdraw');
    }
    this.pending = this.exchanges.pop()!.question;
  }

  probe(question: string): void {
    if (this.conclusion)
      throw new SparringRoundError('The round has concluded');
    if (this.pending)
      throw new SparringRoundError('The last question is still unanswered');
    if (!this.exchanges.length)
      throw new SparringRoundError('The round has not started');
    if (this.followUpsLeft === 0)
      throw new SparringRoundError('No follow-ups are left');
    const text = question.trim();
    if (!text || this.quotesNote(text)) {
      throw new SparringRoundError(
        'A follow-up must be non-empty and must not quote the note',
      );
    }
    this.pending = text;
  }

  conclude(verdict: Verdict, gaps: string[], feedback: string): Conclusion {
    if (this.conclusion)
      throw new SparringRoundError('The round has already concluded');
    if (this.pending || !this.exchanges.length) {
      throw new SparringRoundError(
        'A round concludes only after an accepted answer',
      );
    }
    const allGaps = [...gaps];
    if (this.buzzwordsUsed.size) {
      allGaps.push(
        `Leaned on buzzwords instead of mechanism: ${[...this.buzzwordsUsed].join(', ')}`,
      );
    }
    const named = verdict === 'fail' && !allGaps.length ? 'pass' : verdict;
    const said =
      named === verdict
        ? feedback
        : 'Every gap the coach raised is covered by your answers.';
    this.conclusion = { verdict: named, gaps: allGaps, feedback: said };
    return { ...this.conclusion, gaps: [...allGaps] };
  }

  result(): SparringResult {
    if (!this.conclusion)
      throw new SparringRoundError('The round has not concluded');
    const [first, ...followUps] = this.exchanges;
    return {
      challenge: first!.question,
      answer: [
        first!.answer,
        ...followUps.map(
          (e) => `Follow-up: ${e.question}\nAnswer: ${e.answer}`,
        ),
      ].join('\n\n'),
      verdict: this.conclusion.verdict,
      gaps: [...this.conclusion.gaps],
      exchanges: this.transcript.map((e) => ({ ...e })),
    };
  }
}

import {
  ChallengeQuotesNoteError,
  NEUTRAL_PROBE,
  SparringRound,
  groundedIn,
  type Note,
  type SparringResult,
  type CoachingStyle,
  type SparringRules,
  type Verdict,
} from '@ai-coach/domain';
import { ChallengeLeakError } from '../errors.js';
import type { Reference } from '../history.js';
import type { SparringPartner } from '../ports/models.js';

export type Turn =
  | { kind: 'challenge'; question: string }
  | { kind: 'rephrase'; question: string; buzzwords: string[] }
  | { kind: 'probe'; question: string }
  | { kind: 'verdict'; verdict: Verdict; gaps: string[]; feedback: string };

export class SparringConversation {
  private round: SparringRound;
  private readonly note: Note;
  private focus = '';
  private scope: string[] = [];

  constructor(
    private readonly partner: SparringPartner,
    private readonly reference: Reference,
    private readonly rules: SparringRules,
    readonly style: CoachingStyle,
  ) {
    this.note = reference.note;
    this.round = SparringRound.over(this.note, rules);
  }

  get isConcluded(): boolean {
    return this.round.isConcluded;
  }

  async start(): Promise<Turn> {
    const rejected: string[] = [];
    for (
      let attempt = 0;
      attempt < this.rules.maxChallengeAttempts;
      attempt++
    ) {
      const { focus, scope, jargon, challenge } =
        await this.partner.openingChallenge({
          note: this.note,
          rules: this.rules,
          style: this.style,
          assertions: this.reference.assertions,
          rejected: [...rejected],
        });
      const banned =
        this.style === 'feynman'
          ? [...jargon, ...this.reference.buzzwords]
          : jargon;
      if (banned.length) {
        this.round = SparringRound.over(this.note, {
          ...this.rules,
          buzzwords: [...this.rules.buzzwords, ...banned],
        });
      }
      try {
        this.round.open(challenge);
        this.focus = focus.trim();
        this.scope = scope.map((idea) => idea.trim()).filter(Boolean);
        return { kind: 'challenge', question: this.round.pendingQuestion! };
      } catch (err) {
        if (!(err instanceof ChallengeQuotesNoteError)) throw err;
        rejected.push(challenge);
      }
    }
    throw new ChallengeLeakError(
      `The sparring partner quoted the note in its challenge ${rejected.length} time(s); nothing was recorded`,
    );
  }

  async answer(text: string): Promise<Turn> {
    const submission = this.round.submit(text);
    if (submission.kind === 'rephrase') return submission;

    const followUpsLeft = this.round.followUpsLeft;
    let next;
    try {
      next = await this.partner.nextTurn({
        note: this.note,
        rules: this.rules,
        style: this.style,
        focus: this.focus,
        scope: this.scope,
        exchanges: this.round.transcript,
        followUpsLeft,
        rejected: [],
      });
    } catch (err) {
      this.round.withdrawLastAnswer();
      throw err;
    }

    if (next.action === 'probe' && followUpsLeft > 0) {
      const question = await this.acceptableProbe(next.question);
      this.round.probe(question);
      return { kind: 'probe', question };
    }

    const conclusion =
      next.action === 'conclude'
        ? this.round.conclude(
            next.verdict,
            next.gaps.filter((gap) => groundedIn(this.reference.text, gap)),
            next.feedback,
          )
        : this.round.conclude(
            'fail',
            [`You did not answer this follow-up: ${next.question.trim()}`],
            'The follow-ups ran out before the idea was fully explained.',
          );
    return { kind: 'verdict', ...conclusion };
  }

  result(): SparringResult {
    return this.round.result();
  }

  private async acceptableProbe(question: string): Promise<string> {
    if (question.trim() && !this.round.quotesNote(question))
      return question.trim();
    const retry = await this.partner.nextTurn({
      note: this.note,
      rules: this.rules,
      style: this.style,
      focus: this.focus,
      scope: this.scope,
      exchanges: this.round.transcript,
      followUpsLeft: 1,
      rejected: [question],
    });
    const rewritten = retry.action === 'probe' ? retry.question.trim() : '';
    return rewritten && !this.round.quotesNote(rewritten)
      ? rewritten
      : NEUTRAL_PROBE;
  }
}

import {
  ChallengeQuotesNoteError,
  NEUTRAL_PROBE,
  SparringRound,
  type Note,
  type SparringResult,
  type SparringRules,
  type Verdict,
} from '@ai-coach/domain';
import { ChallengeLeakError } from '../errors.js';
import type { SparringPartner } from '../ports/models.js';

export type Turn =
  | { kind: 'challenge'; question: string }
  | { kind: 'rephrase'; question: string; buzzwords: string[] }
  | { kind: 'probe'; question: string }
  | { kind: 'verdict'; verdict: Verdict; gaps: string[]; feedback: string };

export class SparringConversation {
  private readonly round: SparringRound;
  private focus = '';

  constructor(
    private readonly partner: SparringPartner,
    private readonly note: Note,
    private readonly rules: SparringRules,
  ) {
    this.round = SparringRound.over(note, rules);
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
      const { focus, challenge } = await this.partner.openingChallenge({
        note: this.note,
        rules: this.rules,
        rejected: [...rejected],
      });
      try {
        this.round.open(challenge);
        this.focus = focus.trim();
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
        focus: this.focus,
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
        ? this.round.conclude(next.verdict, next.gaps, next.feedback)
        : this.round.conclude('fail', [], '');
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
      focus: this.focus,
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

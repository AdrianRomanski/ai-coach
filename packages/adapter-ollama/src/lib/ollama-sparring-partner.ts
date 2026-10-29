import {
  UnusableReplyError,
  type ChallengeRequest,
  type NextTurn,
  type NextTurnRequest,
  type OpeningChallenge,
  type SparringPartner,
} from '@ai-coach/application';
import { saidIn } from '@ai-coach/domain';
import { z } from 'zod';
import {
  MAX_SENTENCE,
  OllamaClient,
  firstSentence,
  type OllamaOptions,
} from './ollama-client.js';
import {
  assertionCheckMessages,
  challengeMessages,
  focusMessages,
  gapCheckMessages,
  jargonMessages,
  nextTurnMessages,
  scopeMessages,
  titleFocus,
} from './prompts.js';

const FOCUS_OPENING = /^this note teaches that\b/i;

const GapCheck = z.object({
  covered: z.boolean(),
  evidence: z.string().max(MAX_SENTENCE * 2),
});

const AssertionCheck = z.object({
  evidence: z.string().max(MAX_SENTENCE * 2),
  covered: z.boolean(),
});

const NextTurnReply = z.object({
  action: z.enum(['probe', 'conclude']),
  question: z.string().max(MAX_SENTENCE),
  verdict: z.enum(['pass', 'fail']),
  gaps: z.array(z.string().max(MAX_SENTENCE)).max(6),
  feedback: z.string().max(MAX_SENTENCE),
});

export class OllamaSparringPartner implements SparringPartner {
  private readonly client: OllamaClient;
  private readonly checker: OllamaClient | null;

  constructor(options: OllamaOptions, checkModel?: string) {
    this.client = new OllamaClient(options, 'sparring partner');
    this.checker = checkModel
      ? new OllamaClient({ ...options, model: checkModel }, 'assertion check')
      : null;
  }

  async openingChallenge(request: ChallengeRequest): Promise<OpeningChallenge> {
    const fixed = request.assertions.length > 0;
    const focus = fixed
      ? `This note teaches that ${request.assertions.map((a) => a.trim().replace(/\.$/, '')).join('; ')}.`
      : await this.focus(request);
    const scope = fixed
      ? [...request.assertions]
      : await this.client.lines(scopeMessages(request, this.client.nonce()), 5);
    const challenge = await this.client.sentence(
      challengeMessages(request, focus, this.client.nonce()),
      { kind: 'question' },
    );
    const jargon =
      request.style === 'feynman' && !fixed
        ? await this.client.lines(
            jargonMessages(request, this.client.nonce()),
            3,
            1,
          )
        : [];
    return { focus, scope, jargon, challenge };
  }

  async nextTurn(request: NextTurnRequest): Promise<NextTurn> {
    const reply = await this.client.json(
      nextTurnMessages(request, this.client.nonce()),
      NextTurnReply,
    );
    if (reply.action === 'probe') {
      return { action: 'probe', question: reply.question };
    }
    if (this.checker && request.assertions.length) {
      const missed = await this.missedAssertions(this.checker, request);
      return {
        action: 'conclude',
        verdict: missed.length ? 'fail' : 'pass',
        gaps: missed.map((assertion) => `You did not explain: ${assertion}`),
        feedback: reply.feedback,
      };
    }
    const gaps = await this.uncoveredGaps(request, reply.gaps);
    return {
      action: 'conclude',
      verdict: reply.verdict,
      gaps,
      feedback: reply.feedback,
    };
  }

  private async uncoveredGaps(
    request: NextTurnRequest,
    gaps: string[],
  ): Promise<string[]> {
    const answers = request.exchanges.map((e) => e.answer);
    const kept: string[] = [];
    for (const gap of gaps) {
      if (!(await this.covered(request, gap, answers))) kept.push(gap);
    }
    return kept;
  }

  private async covered(
    request: NextTurnRequest,
    gap: string,
    answers: string[],
  ): Promise<boolean> {
    try {
      const check = await this.client.json(
        gapCheckMessages(request, gap, this.client.nonce()),
        GapCheck,
        { temperature: 0 },
      );
      return check.covered && saidIn(answers, check.evidence);
    } catch (err) {
      if (err instanceof UnusableReplyError) return false;
      throw err;
    }
  }

  private async missedAssertions(
    checker: OllamaClient,
    request: NextTurnRequest,
  ): Promise<string[]> {
    const answers = request.exchanges.map((e) => e.answer);
    const missed: string[] = [];
    for (const assertion of request.assertions) {
      try {
        const check = await checker.json(
          assertionCheckMessages(request, assertion, checker.nonce()),
          AssertionCheck,
          { temperature: 0 },
        );
        if (check.covered && saidIn(answers, check.evidence)) continue;
      } catch (err) {
        if (!(err instanceof UnusableReplyError)) throw err;
      }
      missed.push(assertion);
    }
    return missed;
  }

  private async focus(request: ChallengeRequest): Promise<string> {
    let focus = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      focus = firstSentence(
        await this.client.sentence(
          focusMessages(request, this.client.nonce()),
          { kind: 'statement', temperature: 0 },
        ),
      );
      if (FOCUS_OPENING.test(focus)) return focus;
    }
    return titleFocus(request.note);
  }
}

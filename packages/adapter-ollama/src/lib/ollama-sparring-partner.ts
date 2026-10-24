import type {
  ChallengeRequest,
  NextTurn,
  NextTurnRequest,
  OpeningChallenge,
  SparringPartner,
} from '@ai-coach/application';
import { z } from 'zod';
import {
  MAX_SENTENCE,
  OllamaClient,
  firstSentence,
  type OllamaOptions,
} from './ollama-client.js';
import {
  challengeMessages,
  focusMessages,
  gapCheckMessages,
  nextTurnMessages,
  titleFocus,
} from './prompts.js';

const FOCUS_OPENING = /^this note teaches that\b/i;

const NextTurnReply = z.object({
  action: z.enum(['probe', 'conclude']),
  question: z.string().max(MAX_SENTENCE),
  verdict: z.enum(['pass', 'fail']),
  gaps: z.array(z.string().max(MAX_SENTENCE)).max(6),
  feedback: z.string().max(MAX_SENTENCE),
});

export class OllamaSparringPartner implements SparringPartner {
  private readonly client: OllamaClient;

  constructor(options: OllamaOptions) {
    this.client = new OllamaClient(options, 'sparring partner');
  }

  async openingChallenge(request: ChallengeRequest): Promise<OpeningChallenge> {
    const focus = await this.focus(request);
    const challenge = await this.client.sentence(
      challengeMessages(request, focus, this.client.nonce()),
    );
    return { focus, challenge };
  }

  async nextTurn(request: NextTurnRequest): Promise<NextTurn> {
    const reply = await this.client.json(
      nextTurnMessages(request, this.client.nonce()),
      NextTurnReply,
    );
    if (reply.action === 'probe') {
      return { action: 'probe', question: reply.question };
    }
    const gaps = await this.uncoveredGaps(request, reply.gaps);
    const verdict =
      reply.verdict === 'fail' && reply.gaps.length && !gaps.length
        ? 'pass'
        : reply.verdict;
    return { action: 'conclude', verdict, gaps, feedback: reply.feedback };
  }

  private async uncoveredGaps(
    request: NextTurnRequest,
    gaps: string[],
  ): Promise<string[]> {
    const kept: string[] = [];
    for (const gap of gaps) {
      const covered = await this.client.yesNo(
        gapCheckMessages(request, gap, this.client.nonce()),
      );
      if (covered !== true) kept.push(gap);
    }
    return kept;
  }

  private async focus(request: ChallengeRequest): Promise<string> {
    let focus = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      focus = firstSentence(
        await this.client.sentence(
          focusMessages(request, this.client.nonce()),
          0,
        ),
      );
      if (FOCUS_OPENING.test(focus)) return focus;
    }
    return titleFocus(request.note);
  }
}

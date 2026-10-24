import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { sparringConfig, type SparringConfig } from './config.js';
import {
  SparringModelError,
  type ChatMessage,
  type ChatModel,
} from './model.js';
import {
  challengeMessages,
  nextTurnMessages,
  rewriteMessage,
  type Exchange,
  type SparringNote,
} from './prompts.js';
import { findBuzzwords, quotesSource } from './text.js';

export type Verdict = 'pass' | 'fail';

export type SparringTurn =
  | { kind: 'challenge'; question: string }
  | { kind: 'rephrase'; question: string; buzzwords: string[] }
  | { kind: 'probe'; question: string }
  | { kind: 'verdict'; verdict: Verdict; gaps: string[]; feedback: string };

export interface SparringResult {
  challenge: string;
  answer: string;
  verdict: Verdict;
  gaps: string[];
  exchanges: Exchange[];
}

export class ChallengeLeakError extends SparringModelError {
  constructor(attempts: number) {
    super(
      `The model quoted the note in its challenge ${attempts} time(s); nothing was recorded`,
    );
    this.name = 'ChallengeLeakError';
  }
}

const ChallengeReply = z.object({ challenge: z.string().min(1) });

const NextTurnReply = z.object({
  action: z.enum(['probe', 'conclude']),
  question: z.string(),
  verdict: z.enum(['pass', 'fail']),
  gaps: z.array(z.string()),
  feedback: z.string(),
});

const FALLBACK_PROBE =
  'Walk me through that again step by step, as if I had never heard of it. What happens first, and why?';

export interface SparringSessionOptions {
  model: ChatModel;
  note: SparringNote;
  config?: SparringConfig;
  nonce?: string;
}

export class SparringSession {
  private readonly model: ChatModel;
  private readonly note: SparringNote;
  private readonly config: SparringConfig;
  private readonly nonce: string;
  private readonly exchanges: Exchange[] = [];
  private readonly buzzwordsUsed = new Set<string>();
  private pending: string | null = null;
  private rephrasesLeft: number;
  private concluded: Extract<SparringTurn, { kind: 'verdict' }> | null = null;

  constructor(options: SparringSessionOptions) {
    this.model = options.model;
    this.note = options.note;
    this.config = options.config ?? sparringConfig();
    this.nonce = options.nonce ?? randomBytes(8).toString('hex');
    this.rephrasesLeft = this.config.maxRephrases;
  }

  async start(): Promise<SparringTurn> {
    if (this.pending || this.exchanges.length || this.concluded) {
      throw new Error('This session has already started');
    }
    const messages = challengeMessages(this.config, this.note, this.nonce);
    for (
      let attempt = 1;
      attempt <= this.config.maxChallengeAttempts;
      attempt++
    ) {
      const { challenge } = await this.ask(messages, ChallengeReply);
      if (!this.quotesNote(challenge)) {
        this.pending = challenge;
        return { kind: 'challenge', question: challenge };
      }
      messages.push(
        { role: 'assistant', content: JSON.stringify({ challenge }) },
        rewriteMessage('challenge'),
      );
    }
    throw new ChallengeLeakError(this.config.maxChallengeAttempts);
  }

  async answer(text: string): Promise<SparringTurn> {
    if (this.concluded) throw new Error('This session has already concluded');
    if (!this.pending) throw new Error('Call start() before answering');
    const answer = text.trim();
    if (!answer) throw new Error('An answer cannot be empty');

    const buzzwords = findBuzzwords(answer, this.config.buzzwords);
    buzzwords.forEach((b) => this.buzzwordsUsed.add(b));
    if (buzzwords.length && this.rephrasesLeft > 0) {
      this.rephrasesLeft--;
      return { kind: 'rephrase', question: this.pending, buzzwords };
    }

    const question = this.pending;
    this.exchanges.push({ question, answer });
    this.pending = null;

    const followUpsLeft =
      this.config.maxFollowUps - (this.exchanges.length - 1);
    let reply: z.infer<typeof NextTurnReply>;
    try {
      reply = await this.ask(
        nextTurnMessages(
          this.config,
          this.note,
          this.exchanges,
          followUpsLeft,
          this.nonce,
        ),
        NextTurnReply,
      );
    } catch (err) {
      this.exchanges.pop();
      this.pending = question;
      throw err;
    }
    this.rephrasesLeft = this.config.maxRephrases;

    if (reply.action === 'probe' && followUpsLeft > 0) {
      const probe = await this.safeProbe(reply.question);
      this.pending = probe;
      return { kind: 'probe', question: probe };
    }

    const gaps = [...reply.gaps];
    if (this.buzzwordsUsed.size) {
      gaps.push(
        `Leaned on buzzwords instead of mechanism: ${[...this.buzzwordsUsed].join(', ')}`,
      );
    }
    this.concluded = {
      kind: 'verdict',
      verdict: reply.verdict,
      gaps,
      feedback: reply.feedback,
    };
    return this.concluded;
  }

  get isConcluded(): boolean {
    return this.concluded !== null;
  }

  result(): SparringResult {
    if (!this.concluded) throw new Error('The session has not concluded yet');
    const [first, ...followUps] = this.exchanges;
    return {
      challenge: first!.question,
      answer: [
        first!.answer,
        ...followUps.map(
          (e) => `Follow-up: ${e.question}\nAnswer: ${e.answer}`,
        ),
      ].join('\n\n'),
      verdict: this.concluded.verdict,
      gaps: this.concluded.gaps,
      exchanges: this.exchanges.map((e) => ({ ...e })),
    };
  }

  private async safeProbe(question: string): Promise<string> {
    if (question.trim() && !this.quotesNote(question)) return question.trim();
    const retry = await this.ask(
      [
        ...nextTurnMessages(
          this.config,
          this.note,
          this.exchanges,
          1,
          this.nonce,
        ),
        {
          role: 'assistant',
          content: JSON.stringify({ action: 'probe', question }),
        },
        rewriteMessage('question'),
      ],
      NextTurnReply,
    );
    const rewritten = retry.question.trim();
    return rewritten && !this.quotesNote(rewritten)
      ? rewritten
      : FALLBACK_PROBE;
  }

  private quotesNote(text: string): boolean {
    return quotesSource(text, this.note.body, this.config.verbatimRunWords);
  }

  private async ask<T>(
    messages: ChatMessage[],
    schema: z.ZodType<T>,
  ): Promise<T> {
    const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await this.model.chat({ messages, schema: jsonSchema });
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        lastError = `not JSON: ${raw.slice(0, 200)}`;
        continue;
      }
      const parsed = schema.safeParse(data);
      if (parsed.success) return parsed.data;
      lastError = parsed.error.message;
    }
    throw new SparringModelError(
      `The local model gave an unusable reply: ${lastError}`,
    );
  }
}

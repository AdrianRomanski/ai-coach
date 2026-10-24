import { randomBytes } from 'node:crypto';
import {
  ContextTooSmallError,
  UnavailableError,
  UnusableReplyError,
  type ChallengeRequest,
  type NextTurn,
  type NextTurnRequest,
  type SparringPartner,
} from '@ai-coach/application';
import { z } from 'zod';
import {
  challengeMessages,
  nextTurnMessages,
  type ChatMessage,
} from './prompts.js';

export const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';
export const DEFAULT_CONTEXT_WINDOW = 16_384;
const REPLY_RESERVE = 1_024;
const CHARS_PER_TOKEN = 3;
const SERVICE = 'sparring partner';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export interface OllamaOptions {
  model: string;
  host?: string;
  temperature?: number;
  timeoutMs?: number;
  contextWindow?: number;
  fetch?: typeof fetch;
  nonce?: () => string;
}

export class OfflineViolationError extends Error {
  override readonly name = 'OfflineViolationError';
}

export function assertLoopback(host: string): URL {
  let url: URL;
  try {
    url = new URL(host);
  } catch {
    throw new OfflineViolationError(`Invalid Ollama host: ${host}`);
  }
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new OfflineViolationError(
      `Tier 1 runs offline: the Ollama host must be http on loopback, got ${host}`,
    );
  }
  return url;
}

const ChallengeReply = z.object({ challenge: z.string().min(1) });

const NextTurnReply = z.object({
  action: z.enum(['probe', 'conclude']),
  question: z.string(),
  verdict: z.enum(['pass', 'fail']),
  gaps: z.array(z.string()),
  feedback: z.string(),
});

const OllamaChatResponse = z.object({
  message: z.object({ role: z.string(), content: z.string() }),
});

export class OllamaSparringPartner implements SparringPartner {
  private readonly endpoint: URL;

  constructor(private readonly options: OllamaOptions) {
    this.endpoint = new URL(
      '/api/chat',
      assertLoopback(options.host ?? DEFAULT_OLLAMA_HOST),
    );
  }

  async openingChallenge(request: ChallengeRequest): Promise<string> {
    const reply = await this.ask(
      challengeMessages(request, this.nonce()),
      ChallengeReply,
    );
    return reply.challenge;
  }

  async nextTurn(request: NextTurnRequest): Promise<NextTurn> {
    const reply = await this.ask(
      nextTurnMessages(request, this.nonce()),
      NextTurnReply,
    );
    return reply.action === 'probe'
      ? { action: 'probe', question: reply.question }
      : {
          action: 'conclude',
          verdict: reply.verdict,
          gaps: reply.gaps,
          feedback: reply.feedback,
        };
  }

  private nonce(): string {
    return this.options.nonce?.() ?? randomBytes(8).toString('hex');
  }

  private async ask<T>(
    messages: ChatMessage[],
    schema: z.ZodType<T>,
  ): Promise<T> {
    const { $schema: _ignored, ...format } = z.toJSONSchema(schema) as Record<
      string,
      unknown
    >;
    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await this.chat(messages, format);
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
    throw new UnusableReplyError(
      SERVICE,
      `The local model gave an unusable reply: ${lastError}`,
    );
  }

  private async chat(
    messages: ChatMessage[],
    format: Record<string, unknown>,
  ): Promise<string> {
    const contextWindow = this.options.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
    const chars = messages.reduce((sum, m) => sum + m.content.length, 0);
    const estimate = Math.ceil(chars / CHARS_PER_TOKEN);
    if (estimate > contextWindow - REPLY_RESERVE) {
      throw new ContextTooSmallError(
        `This note needs about ${estimate} tokens, but Gemma's context window is ${contextWindow}: raise ollama.contextWindow or OLLAMA_NUM_CTX`,
      );
    }
    const doFetch = this.options.fetch ?? fetch;
    let response: Response;
    try {
      response = await doFetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.options.model,
          messages,
          format,
          stream: false,
          options: {
            temperature: this.options.temperature ?? 0.4,
            num_ctx: contextWindow,
          },
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 120_000),
      });
    } catch (err) {
      throw new UnavailableError(
        SERVICE,
        `Ollama is not reachable at ${this.endpoint.origin}: ${(err as Error).message}`,
        { cause: err },
      );
    }
    if (!response.ok) {
      throw new UnavailableError(
        SERVICE,
        `Ollama answered ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    }
    const parsed = OllamaChatResponse.safeParse(await response.json());
    if (!parsed.success) {
      throw new UnusableReplyError(
        SERVICE,
        `Unexpected Ollama response: ${parsed.error.message}`,
      );
    }
    return parsed.data.message.content;
  }
}

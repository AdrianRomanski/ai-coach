import { randomBytes } from 'node:crypto';
import {
  ContextTooSmallError,
  UnavailableError,
  UnusableReplyError,
} from '@ai-coach/application';
import { z } from 'zod';
import type { ChatMessage } from './prompts.js';

export const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';
export const DEFAULT_CONTEXT_WINDOW = 16_384;
export const MAX_SENTENCE = 400;
const REPLY_RESERVE = 1_024;
const CHARS_PER_TOKEN = 3;
const SENTENCE_TOKENS = 120;
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

export function firstSentence(text: string): string {
  const match = /^.*?[.!?](?=\s|$)/.exec(text);
  return (match ? match[0] : text).trim();
}

export type SentenceKind = 'question' | 'statement' | 'any';

const PROMPTING =
  /^(explain|describe|walk me|tell me|show|name|compare|imagine|suppose|picture|argue|defend|predict)\b/i;
const FILLER =
  /^(okay|ok|sure|alright|certainly|here|let's|let us|great|got it)\b/i;
const ECHO =
  /which is data|<\/?(note|transcript|focus)-|^the gap\b|^the learner's explanation/i;

export function usable(line: string, kind: SentenceKind): boolean {
  if (line.split(' ').length < 3 || FILLER.test(line) || ECHO.test(line))
    return false;
  if (kind === 'question') return line.endsWith('?') || PROMPTING.test(line);
  if (kind === 'statement') return !line.endsWith('?');
  return true;
}

export function cleanSentence(raw: string): string {
  return raw
    .replace(/<\/?[a-z]+-[0-9a-f]+[^>]*>/gi, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*(focus|challenge|question|hint|answer)\s*:\s*/i, '')
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const OllamaChatResponse = z.object({
  message: z.object({ role: z.string(), content: z.string() }),
});

interface ReplyShape {
  format?: Record<string, unknown>;
  maxTokens: number;
  temperature?: number;
}

export class OllamaClient {
  private readonly endpoint: URL;

  constructor(
    private readonly options: OllamaOptions,
    private readonly service: string,
  ) {
    this.endpoint = new URL(
      '/api/chat',
      assertLoopback(options.host ?? DEFAULT_OLLAMA_HOST),
    );
  }

  nonce(): string {
    return this.options.nonce?.() ?? randomBytes(8).toString('hex');
  }

  async sentence(
    messages: ChatMessage[],
    shape: { kind?: SentenceKind; temperature?: number } = {},
  ): Promise<string> {
    let last = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      last = await this.chat(messages, {
        maxTokens: SENTENCE_TOKENS,
        temperature: shape.temperature,
      });
      const sentence = last
        .split('\n')
        .map(cleanSentence)
        .map((line) =>
          shape.kind === 'statement' ? firstSentence(line) : line,
        )
        .find((line) => usable(line, shape.kind ?? 'any'));
      if (sentence) return sentence;
    }
    throw new UnusableReplyError(
      this.service,
      `The local model gave an unusable sentence: ${last.slice(0, 200)}`,
    );
  }

  async lines(
    messages: ChatMessage[],
    max: number,
    minWords = 2,
  ): Promise<string[]> {
    const raw = await this.chat(messages, {
      maxTokens: Math.max(200, max * 60),
      temperature: 0,
    });
    return raw
      .split('\n')
      .filter((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line))
      .map((line) =>
        cleanSentence(line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')),
      )
      .filter(
        (line) => line.split(' ').length >= minWords && !line.endsWith('?'),
      )
      .slice(0, max);
  }

  async choice(messages: ChatMessage[], count: number): Promise<number | null> {
    const raw = await this.chat(messages, { maxTokens: 8, temperature: 0 });
    const match = /\d+/.exec(raw);
    if (!match) return null;
    const index = Number(match[0]) - 1;
    return index >= 0 && index < count ? index : null;
  }

  async yesNo(messages: ChatMessage[]): Promise<boolean | null> {
    const raw = await this.chat(messages, { maxTokens: 8, temperature: 0 });
    const word = cleanSentence(raw).toLowerCase();
    if (word.startsWith('yes')) return true;
    if (word.startsWith('no')) return false;
    return null;
  }

  async json<T>(
    messages: ChatMessage[],
    schema: z.ZodType<T>,
    shape: { temperature?: number } = {},
  ): Promise<T> {
    const { $schema: _ignored, ...format } = z.toJSONSchema(schema) as Record<
      string,
      unknown
    >;
    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await this.chat(messages, {
        format,
        maxTokens: REPLY_RESERVE,
        temperature: shape.temperature,
      });
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
      this.service,
      `The local model gave an unusable reply: ${lastError}`,
    );
  }

  private async chat(
    messages: ChatMessage[],
    reply: ReplyShape,
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
          ...(reply.format ? { format: reply.format } : {}),
          stream: false,
          options: {
            temperature: reply.temperature ?? this.options.temperature ?? 0.3,
            num_ctx: contextWindow,
            num_predict: reply.maxTokens,
          },
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 120_000),
      });
    } catch (err) {
      throw new UnavailableError(
        this.service,
        `Ollama is not reachable at ${this.endpoint.origin}: ${(err as Error).message}`,
        { cause: err },
      );
    }
    if (!response.ok) {
      throw new UnavailableError(
        this.service,
        `Ollama answered ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    }
    const parsed = OllamaChatResponse.safeParse(await response.json());
    if (!parsed.success) {
      throw new UnusableReplyError(
        this.service,
        `Unexpected Ollama response: ${parsed.error.message}`,
      );
    }
    return parsed.data.message.content;
  }
}

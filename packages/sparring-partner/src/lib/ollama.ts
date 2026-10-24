import { z } from 'zod';
import {
  SparringModelError,
  type ChatModel,
  type ChatRequest,
} from './model.js';

export const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';

export interface OllamaOptions {
  model: string;
  host?: string;
  temperature?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export function assertLoopback(host: string): URL {
  let url: URL;
  try {
    url = new URL(host);
  } catch {
    throw new SparringModelError(`Invalid Ollama host: ${host}`);
  }
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new SparringModelError(
      `Tier 1 runs offline: the Ollama host must be http on loopback, got ${host}`,
    );
  }
  return url;
}

export function ollamaOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): OllamaOptions {
  const model = env['OLLAMA_MODEL'];
  if (!model) {
    throw new SparringModelError(
      'OLLAMA_MODEL is not set: name the Gemma model you pulled, as `ollama list` shows it',
    );
  }
  return { model, host: env['OLLAMA_HOST'] || DEFAULT_OLLAMA_HOST };
}

const OllamaChatResponse = z.object({
  message: z.object({ role: z.string(), content: z.string() }),
});

export class OllamaChatModel implements ChatModel {
  private readonly endpoint: URL;

  constructor(private readonly options: OllamaOptions) {
    this.endpoint = new URL(
      '/api/chat',
      assertLoopback(options.host ?? DEFAULT_OLLAMA_HOST),
    );
  }

  async chat(request: ChatRequest): Promise<string> {
    const doFetch = this.options.fetch ?? fetch;
    let response: Response;
    try {
      response = await doFetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.options.model,
          messages: request.messages,
          format: request.schema,
          stream: false,
          options: { temperature: this.options.temperature ?? 0.4 },
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 120_000),
      });
    } catch (err) {
      throw new SparringModelError(
        `Ollama is not reachable at ${this.endpoint.origin}: ${(err as Error).message}`,
        { cause: err },
      );
    }
    if (!response.ok) {
      throw new SparringModelError(
        `Ollama answered ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    }
    const parsed = OllamaChatResponse.safeParse(await response.json());
    if (!parsed.success) {
      throw new SparringModelError(
        `Unexpected Ollama response: ${parsed.error.message}`,
      );
    }
    return parsed.data.message.content;
  }
}

import { randomBytes } from 'node:crypto';
import {
  UnavailableError,
  UnusableReplyError,
  type Judge,
  type JudgeReport,
} from '@ai-coach/application';
import { tier2Payload, type Tier2Payload } from '@ai-coach/domain';
import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  JudgeReply,
  replyJsonSchema,
  systemInstruction,
  userPrompt,
} from './protocol.js';

export const DEFAULT_JUDGE_MODEL = 'gemini-4-argon';
const SERVICE = 'judge';

export type JudgeThinkingLevel = 'MEDIUM' | 'HIGH';

export interface GenerateContentRequest {
  model: string;
  contents: string;
  config: {
    systemInstruction: string;
    responseMimeType: 'application/json';
    responseJsonSchema: Record<string, unknown>;
    thinkingConfig: { thinkingLevel: ThinkingLevel };
    temperature: number;
  };
}

export interface GenAIClient {
  models: {
    generateContent(
      request: GenerateContentRequest,
    ): Promise<{ text?: string }>;
  };
}

export interface GeminiJudgeOptions {
  model?: string;
  fallbackModel?: string;
  thinkingLevel?: JudgeThinkingLevel;
  client?: GenAIClient;
  nonce?: () => string;
}

function defaultClient(): GenAIClient {
  if (!process.env['GEMINI_API_KEY'] && !process.env['GOOGLE_API_KEY']) {
    throw new UnavailableError(
      SERVICE,
      'GEMINI_API_KEY is not set: create a key in Google AI Studio and export it',
    );
  }
  return new GoogleGenAI({ vertexai: false }) as unknown as GenAIClient;
}

function retryable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 429 || err.status >= 500;
  return err instanceof TypeError;
}

export class GeminiJudge implements Judge {
  private readonly model: string;
  private readonly fallbackModel: string | undefined;
  private readonly thinkingLevel: ThinkingLevel;
  private readonly nonce: () => string;
  private client: GenAIClient | undefined;

  constructor(options: GeminiJudgeOptions = {}) {
    this.model = options.model ?? DEFAULT_JUDGE_MODEL;
    this.fallbackModel = options.fallbackModel;
    this.thinkingLevel =
      options.thinkingLevel === 'HIGH'
        ? ThinkingLevel.HIGH
        : ThinkingLevel.MEDIUM;
    this.client = options.client;
    this.nonce = options.nonce ?? (() => randomBytes(8).toString('hex'));
  }

  async judge(payload: Tier2Payload): Promise<JudgeReport> {
    const checked = tier2Payload(payload);
    try {
      return await this.judgeWith(this.model, checked);
    } catch (err) {
      if (this.fallbackModel && retryable(err)) {
        try {
          return await this.judgeWith(this.fallbackModel, checked);
        } catch (fallbackErr) {
          throw this.translate(fallbackErr);
        }
      }
      throw this.translate(err);
    }
  }

  private translate(err: unknown): unknown {
    if (err instanceof ApiError) {
      return new UnavailableError(
        SERVICE,
        `Gemini answered ${err.status}: ${err.message}`,
        { cause: err },
      );
    }
    if (err instanceof TypeError) {
      return new UnavailableError(
        SERVICE,
        `Gemini is not reachable: ${err.message}`,
        { cause: err },
      );
    }
    return err;
  }

  private async judgeWith(
    model: string,
    payload: Tier2Payload,
  ): Promise<JudgeReport> {
    this.client ??= defaultClient();
    const nonce = this.nonce();
    const request: GenerateContentRequest = {
      model,
      contents: userPrompt(payload, nonce),
      config: {
        systemInstruction: systemInstruction(nonce),
        responseMimeType: 'application/json',
        responseJsonSchema: replyJsonSchema(),
        thinkingConfig: { thinkingLevel: this.thinkingLevel },
        temperature: 0,
      },
    };

    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.client.models.generateContent(request);
      const reply = this.parse(response.text);
      if (typeof reply === 'string') {
        lastError = reply;
        continue;
      }
      if (reply.items.length !== payload.items.length) {
        lastError = `expected ${payload.items.length} judgements, got ${reply.items.length}`;
        continue;
      }
      return { model, items: reply.items };
    }
    throw new UnusableReplyError(
      SERVICE,
      `${model} gave an unusable judgement: ${lastError}`,
    );
  }

  private parse(text: string | undefined): JudgeReply | string {
    if (!text) return 'empty response';
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return `not JSON: ${text.slice(0, 200)}`;
    }
    const reply = JudgeReply.safeParse(data);
    return reply.success ? reply.data : reply.error.message;
  }
}

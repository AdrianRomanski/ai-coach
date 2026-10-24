import { randomBytes } from 'node:crypto';
import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  JudgePayload,
  JudgeReply,
  replyJsonSchema,
  systemInstruction,
  userPrompt,
  type Claim,
  type ItemJudgement,
} from './protocol.js';

export const DEFAULT_JUDGE_MODEL = 'gemini-4-argon';

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

export interface ExternalJudgeOptions {
  model?: string;
  fallbackModel?: string;
  thinkingLevel?: JudgeThinkingLevel;
  client?: GenAIClient;
  nonce?: () => string;
}

export interface Judgement extends ItemJudgement {
  modelVerdict: 'pass' | 'fail';
}

export interface JudgeReport {
  model: string;
  items: Judgement[];
}

export class JudgeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'JudgeError';
  }
}

export function judgeOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ExternalJudgeOptions {
  const level = env['GEMINI_JUDGE_THINKING_LEVEL']?.toUpperCase();
  if (level && level !== 'MEDIUM' && level !== 'HIGH') {
    throw new JudgeError(
      `GEMINI_JUDGE_THINKING_LEVEL must be MEDIUM or HIGH, got ${level}`,
    );
  }
  return {
    model: env['GEMINI_JUDGE_MODEL'] || DEFAULT_JUDGE_MODEL,
    fallbackModel: env['GEMINI_JUDGE_FALLBACK_MODEL'] || undefined,
    thinkingLevel: (level as JudgeThinkingLevel | undefined) ?? 'MEDIUM',
  };
}

function defaultClient(): GenAIClient {
  if (!process.env['GEMINI_API_KEY'] && !process.env['GOOGLE_API_KEY']) {
    throw new JudgeError(
      'GEMINI_API_KEY is not set: create a key in Google AI Studio and export it',
    );
  }
  return new GoogleGenAI({ vertexai: false }) as unknown as GenAIClient;
}

function retryable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 429 || err.status >= 500;
  return err instanceof TypeError;
}

export function enforceVerdict(item: ItemJudgement): Judgement {
  const flawed = item.claims.some((c) => c.fallacies.length > 0 || c.handWave);
  const pass = item.verdict === 'pass' && !flawed && item.gaps.length === 0;
  return {
    ...item,
    modelVerdict: item.verdict,
    verdict: pass ? 'pass' : 'fail',
  };
}

function describeClaim(claim: Claim): string | null {
  const problems = [
    ...claim.fallacies.map((f) => f.replaceAll('_', ' ')),
    ...(claim.handWave ? ['hand-waving'] : []),
  ];
  return problems.length ? `${problems.join(', ')}: "${claim.text}"` : null;
}

export function sessionGaps(judgement: ItemJudgement): string[] {
  const flagged = judgement.claims
    .map(describeClaim)
    .filter((g): g is string => g !== null);
  return [...judgement.gaps, ...flagged];
}

export class ExternalJudge {
  private readonly model: string;
  private readonly fallbackModel: string | undefined;
  private readonly thinkingLevel: ThinkingLevel;
  private readonly nonce: () => string;
  private client: GenAIClient | undefined;

  constructor(options: ExternalJudgeOptions = {}) {
    this.model = options.model ?? DEFAULT_JUDGE_MODEL;
    this.fallbackModel = options.fallbackModel;
    this.thinkingLevel =
      options.thinkingLevel === 'HIGH'
        ? ThinkingLevel.HIGH
        : ThinkingLevel.MEDIUM;
    this.client = options.client;
    this.nonce = options.nonce ?? (() => randomBytes(8).toString('hex'));
  }

  async judge(payload: JudgePayload): Promise<JudgeReport> {
    const parsed = JudgePayload.safeParse(payload);
    if (!parsed.success) {
      throw new JudgeError(
        `Only a tier2_payload may be judged: ${parsed.error.message}`,
      );
    }
    try {
      return await this.judgeWith(this.model, parsed.data);
    } catch (err) {
      if (!this.fallbackModel || !retryable(err)) throw err;
      return this.judgeWith(this.fallbackModel, parsed.data);
    }
  }

  private async judgeWith(
    model: string,
    payload: JudgePayload,
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
      return { model, items: reply.items.map(enforceVerdict) };
    }
    throw new JudgeError(`${model} gave an unusable judgement: ${lastError}`);
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

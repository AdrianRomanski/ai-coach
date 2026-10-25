import type { DistillPartner, IdeaProposal } from '@ai-coach/application';
import type { Exchange, MaterialItem, SparringRules } from '@ai-coach/domain';
import { z } from 'zod';
import { OllamaClient, type OllamaOptions } from './ollama-client.js';
import {
  assertionsMessages,
  buzzwordsMessages,
  distillQuestionsMessages,
  ideasMessages,
} from './prompts.js';

const Ideas = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string().max(120),
        items: z.array(z.number().int()).max(40),
      }),
    )
    .max(12),
});

const Questions = z.object({
  questions: z.array(z.string().max(300)).max(6),
});

export class OllamaDistillPartner implements DistillPartner {
  private readonly client: OllamaClient;

  constructor(options: OllamaOptions) {
    this.client = new OllamaClient(options, 'distill partner');
  }

  async proposeIdeas(request: {
    rules: SparringRules;
    material: readonly MaterialItem[];
    max: number;
  }): Promise<IdeaProposal[]> {
    const reply = await this.client.json(
      ideasMessages(request.material, request.max, this.client.nonce()),
      Ideas,
    );
    return reply.ideas.slice(0, request.max);
  }

  async gapQuestions(request: {
    rules: SparringRules;
    title: string;
    summary: string;
    material: readonly MaterialItem[];
    max: number;
  }): Promise<string[]> {
    const reply = await this.client.json(
      distillQuestionsMessages(request, request.max, this.client.nonce()),
      Questions,
    );
    return reply.questions
      .map((q) => q.replace(/\s+/g, ' ').trim())
      .filter((q) => q.endsWith('?'))
      .slice(0, request.max);
  }

  draftAssertions(request: {
    rules: SparringRules;
    title: string;
    summary: string;
    answers: readonly Exchange[];
    max: number;
  }): Promise<string[]> {
    return this.client.lines(
      assertionsMessages(request, request.max, this.client.nonce()),
      request.max,
      3,
    );
  }

  suggestBuzzwords(request: {
    rules: SparringRules;
    title: string;
    material: readonly MaterialItem[];
    max: number;
  }): Promise<string[]> {
    return this.client.lines(
      buzzwordsMessages(request, request.max, this.client.nonce()),
      request.max,
      1,
    );
  }
}

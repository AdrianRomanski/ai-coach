import type { StyleClassifier } from '@ai-coach/application';
import type { CoachingStyle, Note, SparringRules } from '@ai-coach/domain';
import { OllamaClient, type OllamaOptions } from './ollama-client.js';
import { classifyMessages } from './prompts.js';

export class OllamaStyleClassifier implements StyleClassifier {
  private readonly client: OllamaClient;

  constructor(options: OllamaOptions) {
    this.client = new OllamaClient(options, 'style classifier');
  }

  async classify(note: Note, _rules: SparringRules): Promise<CoachingStyle> {
    const choice = await this.client.choice(
      classifyMessages(note, this.client.nonce()),
      2,
    );
    return choice === 1 ? 'feynman' : 'cornell';
  }
}

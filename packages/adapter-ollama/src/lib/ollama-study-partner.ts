import {
  UnusableReplyError,
  type StudyCheck,
  type StudyPartner,
  type StudyRequest,
} from '@ai-coach/application';
import { OllamaClient, type OllamaOptions } from './ollama-client.js';
import {
  closesGapMessages,
  hintMessages,
  nudgeMessages,
  quoteMessages,
} from './prompts.js';

export class OllamaStudyPartner implements StudyPartner {
  private readonly client: OllamaClient;

  constructor(options: OllamaOptions) {
    this.client = new OllamaClient(options, 'study partner');
  }

  hint(request: StudyRequest): Promise<string> {
    return this.client.sentence(hintMessages(request, this.client.nonce()));
  }

  async quote(request: StudyRequest): Promise<string> {
    try {
      return await this.client.sentence(
        quoteMessages(request, this.client.nonce()),
        0,
      );
    } catch (err) {
      if (err instanceof UnusableReplyError) return '';
      throw err;
    }
  }

  async check(
    request: StudyRequest & { explanation: string },
  ): Promise<StudyCheck> {
    const closed = await this.client.yesNo(
      closesGapMessages(request, this.client.nonce()),
    );
    if (closed === true) return { closed: true, nudge: '' };
    const nudge = await this.client.sentence(
      nudgeMessages(request, this.client.nonce()),
    );
    return { closed: false, nudge };
  }
}

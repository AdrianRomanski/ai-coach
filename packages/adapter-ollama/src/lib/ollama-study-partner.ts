import {
  UnusableReplyError,
  type StudyCheck,
  type StudyPartner,
  type StudyRequest,
} from '@ai-coach/application';
import { OllamaClient, type OllamaOptions } from './ollama-client.js';
import {
  clueMessages,
  hintMessages,
  nudgeMessages,
  quoteMessages,
  referenceMessages,
  sameAsReferenceMessages,
} from './prompts.js';

export class OllamaStudyPartner implements StudyPartner {
  private readonly client: OllamaClient;

  constructor(options: OllamaOptions) {
    this.client = new OllamaClient(options, 'study partner');
  }

  clue(request: StudyRequest): Promise<string> {
    return this.client.sentence(clueMessages(request, this.client.nonce()), {
      kind: 'statement',
    });
  }

  hint(request: StudyRequest): Promise<string> {
    return this.client.sentence(hintMessages(request, this.client.nonce()), {
      kind: 'question',
    });
  }

  async quote(request: StudyRequest): Promise<string> {
    try {
      return await this.client.sentence(
        quoteMessages(request, this.client.nonce()),
        { kind: 'statement', temperature: 0 },
      );
    } catch (err) {
      if (err instanceof UnusableReplyError) return '';
      throw err;
    }
  }

  async check(
    request: StudyRequest & { explanation: string },
  ): Promise<StudyCheck> {
    const reference = request.assertions.length
      ? request.assertions.join(' ')
      : await this.client.sentence(
          referenceMessages(request, this.client.nonce()),
          { kind: 'statement', temperature: 0 },
        );
    const closed = await this.client.yesNo(
      sameAsReferenceMessages(request, reference, this.client.nonce()),
    );
    if (closed === true) return { closed: true, nudge: '' };
    const nudge = await this.client.sentence(
      nudgeMessages(request, this.client.nonce()),
      { kind: 'statement' },
    );
    return { closed: false, nudge };
  }
}

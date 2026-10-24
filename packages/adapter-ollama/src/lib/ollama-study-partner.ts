import {
  UnusableReplyError,
  type ChapterChoice,
  type StudyCheck,
  type StudyPartner,
  type StudyRequest,
} from '@ai-coach/application';
import { OllamaClient, type OllamaOptions } from './ollama-client.js';
import {
  chapterChoiceMessages,
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

  chooseChapter(request: ChapterChoice): Promise<number | null> {
    return this.client.choice(
      chapterChoiceMessages(request, this.client.nonce()),
      request.chapters.length,
    );
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
    const reference = await this.client.sentence(
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

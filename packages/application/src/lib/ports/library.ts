import type {
  ConceptDraft,
  Exchange,
  MaterialItem,
  SparringRules,
} from '@ai-coach/domain';

export type ChapterState = 'untouched' | 'in_progress' | 'complete';

export interface BookProgress {
  index: string;
  folder: string;
  title: string;
  author: string | null;
  stage: string;
  notes: string[];
  chapters: {
    path: string;
    title: string;
    summary: boolean;
    state: ChapterState;
  }[];
}

export interface PassageHit {
  note: string;
  title: string;
  page: number | null;
  snippet: string;
}

export interface ConceptCheck {
  path: string | null;
  collisions: string[];
  passages: {
    note: string;
    quote: string;
    pages: string | null;
    found: boolean;
    problem: string | null;
  }[];
  executed: boolean;
}

export interface Library {
  readingProgress(book?: string): Promise<BookProgress[]>;
  findPassages(
    query: string,
    options: { within?: string; limit?: number },
  ): Promise<PassageHit[]>;
  createConcept(draft: ConceptDraft, execute: boolean): Promise<ConceptCheck>;
}

export interface IdeaProposal {
  title: string;
  items: number[];
}

export interface DistillPartner {
  proposeIdeas(request: {
    rules: SparringRules;
    material: readonly MaterialItem[];
    max: number;
  }): Promise<IdeaProposal[]>;
  gapQuestions(request: {
    rules: SparringRules;
    title: string;
    summary: string;
    material: readonly MaterialItem[];
    max: number;
  }): Promise<string[]>;
  draftAssertions(request: {
    rules: SparringRules;
    title: string;
    summary: string;
    answers: readonly Exchange[];
    max: number;
  }): Promise<string[]>;
  suggestBuzzwords(request: {
    rules: SparringRules;
    title: string;
    material: readonly MaterialItem[];
    max: number;
  }): Promise<string[]>;
}

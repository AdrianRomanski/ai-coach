export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  schema: Record<string, unknown>;
}

export interface ChatModel {
  chat(request: ChatRequest): Promise<string>;
}

export class SparringModelError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SparringModelError';
  }
}

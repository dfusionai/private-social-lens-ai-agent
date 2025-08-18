import { Observable } from 'rxjs';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface ModelResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ModelApiOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export abstract class ModelApiService {
  abstract chat(
    messages: ChatMessage[],
    options?: ModelApiOptions,
  ): Promise<ModelResponse>;

  abstract chatStream(
    messages: ChatMessage[],
    options?: ModelApiOptions,
  ): Observable<StreamChunk>;

  abstract getAvailableModels(): string[];
}

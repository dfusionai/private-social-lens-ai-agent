import { EmbeddingProvider } from '../enums/embedding-provider.enum';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  url?: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingBatchResponse {
  embeddings: number[][];
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export abstract class EmbeddingService {
  protected config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;
  }

  abstract generateEmbedding(text: string): Promise<number[]>;
  abstract generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
  abstract validateConfig(): Promise<boolean>;
  abstract getEmbeddingDimensions(): number;
  abstract getProviderName(): string;
}

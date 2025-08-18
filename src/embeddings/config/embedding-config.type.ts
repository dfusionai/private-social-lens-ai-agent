import { EmbeddingProvider } from '../enums/embedding-provider.enum';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  openai: {
    apiKey: string;
    model: string;
    dimensions: number;
    timeout: number;
    retries: number;
  };
  ollama: {
    url: string;
    model: string;
    dimensions: number;
    timeout: number;
    retries: number;
  };
  transformers: {
    model: string;
    dimensions: number;
    timeout: number;
    retries: number;
  };
}

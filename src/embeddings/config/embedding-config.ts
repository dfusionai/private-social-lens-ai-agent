import { EmbeddingProvider } from '../enums/embedding-provider.enum';
import { EmbeddingConfig } from '../interfaces/embedding.interface';

export interface AzureOpenAIEmbeddingConfig extends EmbeddingConfig {
  provider: EmbeddingProvider.AZUREOPENAI;
  model: string;
  dimensions: number;
  apiKey: string;
  endpoint: string;
  apiVersion: string;
  deployment: string;
}

export interface OpenAIEmbeddingConfig extends EmbeddingConfig {
  provider: EmbeddingProvider.OPENAI;
  model: string;
  dimensions: number;
  apiKey: string;
}

export interface OllamaEmbeddingConfig extends EmbeddingConfig {
  provider: EmbeddingProvider.OLLAMA;
  model: string;
  dimensions: number;
  url: string;
}

export interface TransformersEmbeddingConfig extends EmbeddingConfig {
  provider: EmbeddingProvider.TRANSFORMERS;
  model: string;
  dimensions: number;
}

export type EmbeddingProviderConfig =
  | AzureOpenAIEmbeddingConfig
  | OpenAIEmbeddingConfig
  | OllamaEmbeddingConfig
  | TransformersEmbeddingConfig;

export const DEFAULT_EMBEDDING_CONFIGS: Record<
  EmbeddingProvider,
  Partial<EmbeddingConfig>
> = {
  [EmbeddingProvider.AZUREOPENAI]: {
    model: 'text-embedding-3-small',
    dimensions: 768,
    timeout: 180000,
    retries: 3,
  },
  [EmbeddingProvider.OPENAI]: {
    model: 'text-embedding-3-small',
    dimensions: 1536,
    timeout: 180000,
    retries: 3,
  },
  [EmbeddingProvider.OLLAMA]: {
    model: 'mxbai-embed-large',
    dimensions: 1024,
    url: 'http://localhost:11434',
    timeout: 180000,
    retries: 3,
  },
  [EmbeddingProvider.TRANSFORMERS]: {
    model: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384,
    timeout: 180000,
    retries: 1,
  },
};

export const EMBEDDING_MODEL_DIMENSIONS: Record<string, number> = {
  // OpenAI models
  'text-embedding-3-small': 768,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,

  // Ollama models
  'nomic-embed-text': 768,
  'mxbai-embed-large': 1024,
  'snowflake-arctic-embed': 1024,
  'all-minilm': 384,

  // Transformers models
  'Xenova/all-MiniLM-L6-v2': 384,
  'Xenova/all-mpnet-base-v2': 768,
  'Xenova/bge-small-en-v1.5': 384,
  'Xenova/bge-base-en-v1.5': 768,
};

import { registerAs } from '@nestjs/config';
import { EmbeddingProvider } from '../enums/embedding-provider.enum';
import { EmbeddingConfig } from './embedding-config.type';

export default registerAs(
  'embedding',
  (): EmbeddingConfig => ({
    provider:
      (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) ||
      EmbeddingProvider.OPENAI,
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.EMBEDDING_OPENAI_MODEL || 'text-embedding-3-small',
      dimensions: parseInt(process.env.EMBEDDING_OPENAI_DIMENSIONS || '1536'),
      timeout: parseInt(process.env.EMBEDDING_OPENAI_TIMEOUT || '30000'),
      retries: parseInt(process.env.EMBEDDING_OPENAI_RETRIES || '3'),
    },
    ollama: {
      url: process.env.EMBEDDING_OLLAMA_URL || 'http://localhost:11434',
      model: process.env.EMBEDDING_OLLAMA_MODEL || 'nomic-embed-text',
      dimensions: parseInt(process.env.EMBEDDING_OLLAMA_DIMENSIONS || '768'),
      timeout: parseInt(process.env.EMBEDDING_OLLAMA_TIMEOUT || '30000'),
      retries: parseInt(process.env.EMBEDDING_OLLAMA_RETRIES || '3'),
    },
    transformers: {
      model:
        process.env.EMBEDDING_TRANSFORMERS_MODEL || 'Xenova/all-MiniLM-L6-v2',
      dimensions: parseInt(
        process.env.EMBEDDING_TRANSFORMERS_DIMENSIONS || '384',
      ),
      timeout: parseInt(process.env.EMBEDDING_TRANSFORMERS_TIMEOUT || '60000'),
      retries: parseInt(process.env.EMBEDDING_TRANSFORMERS_RETRIES || '1'),
    },
  }),
);

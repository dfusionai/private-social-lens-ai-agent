import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from './enums/embedding-provider.enum';
import {
  EmbeddingService,
  EmbeddingConfig,
} from './interfaces/embedding.interface';
import { OpenAIEmbeddingService } from './services/openai-embedding.service';
import { OllamaEmbeddingService } from './services/ollama-embedding.service';
// import { TransformersEmbeddingService } from './services/transformers-embedding.service';
import {
  DEFAULT_EMBEDDING_CONFIGS,
  EMBEDDING_MODEL_DIMENSIONS,
} from './config/embedding-config';
import { AllConfigType } from '../config/config.type';

@Injectable()
export class EmbeddingsFactoryService {
  private readonly logger = new Logger(EmbeddingsFactoryService.name);
  private embeddingService: EmbeddingService;

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  async createEmbeddingService(): Promise<EmbeddingService> {
    if (this.embeddingService) {
      return this.embeddingService;
    }

    const provider = this.configService.get('embedding.provider', {
      infer: true,
    }) as EmbeddingProvider;
    const config = this.buildEmbeddingConfig(provider);

    this.embeddingService = await this.instantiateProvider(provider, config);

    const isValid = await this.embeddingService.validateConfig();
    if (!isValid) {
      throw new Error(
        `Invalid configuration for embedding provider: ${provider}`,
      );
    }

    this.logger.log(`Embedding service initialized with provider: ${provider}`);
    return this.embeddingService;
  }

  private buildEmbeddingConfig(provider: EmbeddingProvider): EmbeddingConfig {
    const baseConfig = DEFAULT_EMBEDDING_CONFIGS[provider];
    const model =
      this.configService.get(`embedding.${provider}.model`, { infer: true }) ||
      baseConfig.model ||
      '';
    const dimensions =
      EMBEDDING_MODEL_DIMENSIONS[model] || baseConfig.dimensions || 1536;

    const config: EmbeddingConfig = {
      provider,
      model,
      dimensions,
      timeout:
        this.configService.get(`embedding.${provider}.timeout`, {
          infer: true,
        }) ||
        baseConfig.timeout ||
        30000,
      retries:
        this.configService.get(`embedding.${provider}.retries`, {
          infer: true,
        }) ||
        baseConfig.retries ||
        3,
    };

    switch (provider) {
      case EmbeddingProvider.OPENAI:
        config.apiKey =
          this.configService.get('embedding.openai.apiKey', { infer: true }) ||
          this.configService.get('openai.apiKey', { infer: true });
        break;

      case EmbeddingProvider.OLLAMA:
        config.url =
          this.configService.get('embedding.ollama.url', { infer: true }) ||
          baseConfig.url;
        break;

      case EmbeddingProvider.TRANSFORMERS:
        break;
    }

    return config;
  }

  private async instantiateProvider(
    provider: EmbeddingProvider,
    config: EmbeddingConfig,
  ): Promise<EmbeddingService> {
    switch (provider) {
      case EmbeddingProvider.OPENAI:
        return new OpenAIEmbeddingService(config);

      case EmbeddingProvider.OLLAMA:
        return new OllamaEmbeddingService(config);

      case EmbeddingProvider.TRANSFORMERS:
        // Dynamic import to avoid build errors when @xenova/transformers is not installed
        const { TransformersEmbeddingService } = await import(
          './services/transformers-embedding.service'
        );
        return new TransformersEmbeddingService(config);

      default:
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }
  }

  async getEmbeddingService(): Promise<EmbeddingService> {
    return this.embeddingService || (await this.createEmbeddingService());
  }
}

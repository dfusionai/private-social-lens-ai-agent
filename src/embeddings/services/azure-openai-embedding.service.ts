import { Logger } from '@nestjs/common';
import { AzureOpenAI } from 'openai';
import {
  EmbeddingService,
  EmbeddingConfig,
} from '../interfaces/embedding.interface';

export class AzureOpenAIEmbeddingService extends EmbeddingService {
  private readonly logger = new Logger(AzureOpenAIEmbeddingService.name);
  private azureOpenAI: AzureOpenAI;

  constructor(config: EmbeddingConfig) {
    super(config);
    this.azureOpenAI = new AzureOpenAI({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      apiVersion: config.apiVersion,
      deployment: config.deployment,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    this.logger.log('AzureOpenAIEmbeddingService generateEmbedding');
    try {
      const response = await this.azureOpenAI.embeddings.create({
        model: this.config.model,
        input: [text],
        dimensions: this.config.dimensions || 768,
      });
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error('Failed to generate OpenAI embedding:', error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.azureOpenAI.embeddings.create({
        model: this.config.model,
        input: texts,
        dimensions: this.config.dimensions || 768,
      });
      return response.data.map((item) => item.embedding);
    } catch (error) {
      this.logger.error('Failed to generate OpenAI batch embeddings:', error);
      throw error;
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.azureOpenAI.models.list();
      return true;
    } catch (error) {
      this.logger.error('OpenAI config validation failed:', error);
      return false;
    }
  }

  getEmbeddingDimensions(): number {
    return this.config.dimensions;
  }

  getProviderName(): string {
    return 'OpenAI';
  }
}

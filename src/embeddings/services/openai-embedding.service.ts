import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  EmbeddingService,
  EmbeddingConfig,
} from '../interfaces/embedding.interface';

@Injectable()
export class OpenAIEmbeddingService extends EmbeddingService {
  private readonly logger = new Logger(OpenAIEmbeddingService.name);
  private openai: OpenAI;

  constructor(config: EmbeddingConfig) {
    super(config);
    this.openai = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error('Failed to generate OpenAI embedding:', error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: texts,
      });
      return response.data.map((item) => item.embedding);
    } catch (error) {
      this.logger.error('Failed to generate OpenAI batch embeddings:', error);
      throw error;
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.openai.models.list();
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

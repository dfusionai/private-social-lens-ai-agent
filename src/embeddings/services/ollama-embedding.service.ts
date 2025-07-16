import { Injectable, Logger } from '@nestjs/common';
import {
  EmbeddingService,
  EmbeddingConfig,
} from '../interfaces/embedding.interface';

@Injectable()
export class OllamaEmbeddingService extends EmbeddingService {
  private readonly logger = new Logger(OllamaEmbeddingService.name);
  private readonly baseUrl: string;

  constructor(config: EmbeddingConfig) {
    super(config);
    this.baseUrl = config.url || 'http://localhost:11434';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      this.logger.error('Failed to generate Ollama embedding:', error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const embeddings = await Promise.all(
        texts.map((text) => this.generateEmbedding(text)),
      );
      return embeddings;
    } catch (error) {
      this.logger.error('Failed to generate Ollama batch embeddings:', error);
      throw error;
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const models = data.models || [];
      const hasModel = models.some(
        (model: any) => model.name === this.config.model,
      );

      if (!hasModel) {
        this.logger.warn(
          `Model ${this.config.model} not found in Ollama. Available models: ${models.map((m: any) => m.name).join(', ')}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Ollama config validation failed:', error);
      return false;
    }
  }

  getEmbeddingDimensions(): number {
    return this.config.dimensions;
  }

  getProviderName(): string {
    return 'Ollama';
  }
}

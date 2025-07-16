import { Logger } from '@nestjs/common';
import {
  EmbeddingService,
  EmbeddingConfig,
} from '../interfaces/embedding.interface';

export class TransformersEmbeddingService extends EmbeddingService {
  private readonly logger = new Logger(TransformersEmbeddingService.name);
  private pipeline: any;
  private isInitialized = false;

  constructor(config: EmbeddingConfig) {
    super(config);
  }

  private async initializePipeline() {
    if (this.isInitialized) return;

    try {
      // Use dynamic import with proper error handling
      const transformersModule = await eval(`import('@xenova/transformers')`);
      this.pipeline = await transformersModule.pipeline(
        'feature-extraction',
        this.config.model,
      );
      this.isInitialized = true;
      this.logger.log(
        `Transformers pipeline initialized with model: ${this.config.model}`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to initialize Transformers pipeline. Make sure @xenova/transformers is installed:',
        error,
      );
      throw new Error(
        `Failed to initialize Transformers pipeline: ${error.message}. Install @xenova/transformers to use this provider.`,
      );
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      await this.initializePipeline();

      const output = await this.pipeline(text, {
        pooling: 'mean',
        normalize: true,
      });

      return Array.from(output.data);
    } catch (error) {
      this.logger.error('Failed to generate Transformers embedding:', error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      await this.initializePipeline();

      const embeddings = await Promise.all(
        texts.map((text) => this.generateEmbedding(text)),
      );

      return embeddings;
    } catch (error) {
      this.logger.error(
        'Failed to generate Transformers batch embeddings:',
        error,
      );
      throw error;
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.initializePipeline();
      return true;
    } catch (error) {
      this.logger.error('Transformers config validation failed:', error);
      return false;
    }
  }

  getEmbeddingDimensions(): number {
    return this.config.dimensions;
  }

  getProviderName(): string {
    return 'Transformers';
  }
}

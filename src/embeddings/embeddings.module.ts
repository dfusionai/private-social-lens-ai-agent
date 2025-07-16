import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmbeddingsFactoryService } from './embeddings-factory.service';
import { OpenAIEmbeddingService } from './services/openai-embedding.service';
import { OllamaEmbeddingService } from './services/ollama-embedding.service';
// import { TransformersEmbeddingService } from './services/transformers-embedding.service';
import { EmbeddingService } from './interfaces/embedding.interface';
import embeddingConfig from './config/embedding.config';

@Module({
  imports: [ConfigModule.forFeature(embeddingConfig)],
  providers: [
    EmbeddingsFactoryService,
    OpenAIEmbeddingService,
    OllamaEmbeddingService,
    // TransformersEmbeddingService,
    {
      provide: EmbeddingService,
      useFactory: async (factory: EmbeddingsFactoryService) => {
        return await factory.createEmbeddingService();
      },
      inject: [EmbeddingsFactoryService],
    },
  ],
  exports: [EmbeddingService, EmbeddingsFactoryService],
})
export class EmbeddingsModule {}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  VectorDbService,
  VectorDbConfig,
} from './interfaces/vector-db.interface';
import { VectorDbProvider } from './enums/vector-db-provider.enum';
import { QdrantService } from './providers/qdrant.service';

@Injectable()
export class VectorDbFactory {
  private readonly logger = new Logger(VectorDbFactory.name);
  private serviceInstance: VectorDbService;

  constructor(private readonly configService: ConfigService) {}

  async createVectorDbService(): Promise<VectorDbService> {
    if (this.serviceInstance) {
      return this.serviceInstance;
    }

    const provider = this.getProvider();
    const config = this.getConfig(provider);

    this.logger.log(
      `Creating vector database service with provider: ${provider}`,
    );

    switch (provider) {
      case VectorDbProvider.QDRANT:
        this.serviceInstance = new QdrantService(this.configService, config);
        break;

      // Future implementations can be added here
      // case VectorDbProvider.CHROMA:
      //   this.serviceInstance = new ChromaService(this.configService, config);
      //   break;

      // case VectorDbProvider.PINECONE:
      //   this.serviceInstance = new PineconeService(this.configService, config);
      //   break;

      default:
        throw new Error(`Unsupported vector database provider: ${provider}`);
    }

    await this.serviceInstance.initialize();
    return this.serviceInstance;
  }

  private getProvider(): VectorDbProvider {
    const provider =
      this.configService.get<string>('VECTOR_DB_PROVIDER', { infer: true }) ||
      'qdrant';

    if (
      !Object.values(VectorDbProvider).includes(provider as VectorDbProvider)
    ) {
      this.logger.warn(
        `Invalid provider "${provider}", falling back to qdrant`,
      );
      return VectorDbProvider.QDRANT;
    }

    return provider as VectorDbProvider;
  }

  private getConfig(provider: VectorDbProvider): VectorDbConfig {
    const baseConfig = {
      collectionName:
        this.configService.get<string>('VECTOR_DB_COLLECTION_NAME', {
          infer: true,
        }) || 'chat_documents',
      embeddingModel:
        this.configService.get<string>('VECTOR_DB_EMBEDDING_MODEL', {
          infer: true,
        }) || 'text-embedding-3-small',
      embeddingDimensions: parseInt(
        this.configService.get<string>('VECTOR_DB_EMBEDDING_DIMENSIONS', {
          infer: true,
        }) || '1536',
      ),
    };

    switch (provider) {
      case VectorDbProvider.QDRANT:
        return {
          ...baseConfig,
          url:
            this.configService.get<string>('QDRANT_URL', { infer: true }) ||
            'http://localhost:6333',
        };

      // Future configurations can be added here
      // case VectorDbProvider.CHROMA:
      //   return {
      //     ...baseConfig,
      //     url: this.configService.get<string>('CHROMA_URL') || 'http://localhost:8000',
      //   };

      default:
        throw new Error(`No configuration found for provider: ${provider}`);
    }
  }

  async getService(): Promise<VectorDbService> {
    if (!this.serviceInstance) {
      await this.createVectorDbService();
    }
    return this.serviceInstance;
  }
}

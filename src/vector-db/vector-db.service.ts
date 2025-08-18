import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { VectorDbFactory } from './vector-db-factory.service';
import {
  VectorDbService as IVectorDbService,
  DocumentChunk,
  SearchResult,
  CollectionInfo,
} from './interfaces/vector-db.interface';

@Injectable()
export class VectorDbService implements OnModuleInit {
  private readonly logger = new Logger(VectorDbService.name);
  private vectorDbService: IVectorDbService;

  constructor(private readonly vectorDbFactory: VectorDbFactory) {}

  async onModuleInit() {
    try {
      this.vectorDbService = await this.vectorDbFactory.getService();
      this.logger.log('Vector database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize vector database:', error);
    }
  }

  async addDocuments(documents: DocumentChunk[]): Promise<void> {
    return this.vectorDbService.addDocuments(documents);
  }

  async addDocument(
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<string> {
    return this.vectorDbService.addDocument(content, metadata);
  }

  async searchSimilar(
    query: string,
    limit: number = 5,
    filter?: Record<string, any>,
  ): Promise<SearchResult[]> {
    return this.vectorDbService.searchSimilar(query, limit, filter);
  }

  async deleteDocument(id: string): Promise<void> {
    return this.vectorDbService.deleteDocument(id);
  }

  async deleteDocumentsByMetadata(filter: Record<string, any>): Promise<void> {
    return this.vectorDbService.deleteDocumentsByMetadata(filter);
  }

  async updateDocument(
    id: string,
    content?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    return this.vectorDbService.updateDocument(id, content, metadata);
  }

  async getDocumentsByConversation(
    conversationId: string,
  ): Promise<SearchResult[]> {
    return this.vectorDbService.getDocumentsByConversation(conversationId);
  }

  async getDocumentsByUser(userId: string): Promise<SearchResult[]> {
    return this.vectorDbService.getDocumentsByUser(userId);
  }

  async getCollectionInfo(): Promise<CollectionInfo> {
    return this.vectorDbService.getCollectionInfo();
  }
}

// Export the interfaces and types for external use
export {
  DocumentChunk,
  SearchResult,
  CollectionInfo,
} from './interfaces/vector-db.interface';
export { VectorDbProvider } from './enums/vector-db-provider.enum';

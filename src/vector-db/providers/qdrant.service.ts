import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';
import { AllConfigType } from '../../config/config.type';
import { EmbeddingService } from '../../embeddings/interfaces/embedding.interface';
import {
  VectorDbService,
  DocumentChunk,
  SearchResult,
  CollectionInfo,
  VectorDbConfig,
} from '../interfaces/vector-db.interface';

@Injectable()
export class QdrantService extends VectorDbService {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly embeddingService: EmbeddingService,
    config: VectorDbConfig,
  ) {
    super(config);

    this.client = new QdrantClient({
      url: config.url,
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.client.getCollection(this.collectionName);
      this.logger.log('Collection already exists');
    } catch {
      this.logger.log('Collection not found, creating new collection');
      const dimensions = this.embeddingService.getEmbeddingDimensions();
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: dimensions,
          distance: 'Cosine',
        },
      });
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      return await this.embeddingService.generateEmbedding(text);
    } catch (error) {
      this.logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  async addDocuments(documents: DocumentChunk[]): Promise<void> {
    try {
      const points = await Promise.all(
        documents.map(async (doc) => ({
          id: doc.id,
          vector: await this.generateEmbedding(doc.content),
          payload: {
            content: doc.content,
            ...doc.metadata,
            timestamp:
              doc.metadata.timestamp?.toISOString() || new Date().toISOString(),
          },
        })),
      );

      await this.client.upsert(this.collectionName, {
        wait: true,
        points,
      });

      this.logger.log(`Added ${documents.length} documents to vector database`);
    } catch (error) {
      this.logger.error('Failed to add documents:', error);
      throw error;
    }
  }

  async addDocument(
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<string> {
    const id = uuidv4();
    const document: DocumentChunk = {
      id,
      content,
      metadata: {
        ...metadata,
        timestamp: new Date(),
      },
    };

    await this.addDocuments([document]);
    return id;
  }

  async searchSimilar(
    query: string,
    limit: number = 5,
    filter?: Record<string, any>,
  ): Promise<SearchResult[]> {
    try {
      const queryVector = await this.generateEmbedding(query);

      const searchParams: any = {
        vector: queryVector,
        limit,
        with_payload: true,
        with_vectors: false,
      };

      if (filter) {
        searchParams.filter = { must: [] };
        Object.entries(filter).forEach(([key, value]) => {
          searchParams.filter.must.push({
            key,
            match: { value },
          });
        });
      }

      this.logger.log(`🔍 Vector Search Query: "${query}"`);
      this.logger.log(
        `🔍 Search Params:`,
        JSON.stringify(searchParams, null, 2),
      );

      const results = await this.client.search(
        this.collectionName,
        searchParams,
      );

      this.logger.log(`🔍 Raw Results:`, {
        resultsCount: results.length,
        scores: results.map((r) => r.score),
        ids: results.map((r) => r.id),
      });

      if (!results || results.length === 0) {
        this.logger.log('🔍 No documents found in vector DB');
        return [];
      }

      const processedResults = results.map((result) => ({
        id: result.id.toString(),
        content: result.payload?.content?.toString().substring(0, 100) + '...',
        score: result.score,
        metadata: result.payload || {},
      }));

      this.logger.log(`🔍 Processed Results:`, processedResults);

      return results.map((result) => ({
        id: result.id.toString(),
        content: result.payload?.content?.toString() || '',
        score: result.score,
        metadata: result.payload || {},
      }));
    } catch (error) {
      this.logger.error('Failed to search documents:', error);
      throw error;
    }
  }

  async deleteDocument(id: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        points: [id],
      });
      this.logger.log(`Deleted document with id: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete document ${id}:`, error);
      throw error;
    }
  }

  async deleteDocumentsByMetadata(filter: Record<string, any>): Promise<void> {
    try {
      const filterConditions: any = { must: [] };
      Object.entries(filter).forEach(([key, value]) => {
        filterConditions.must.push({
          key,
          match: { value },
        });
      });

      await this.client.delete(this.collectionName, {
        filter: filterConditions,
      });
      this.logger.log('Deleted documents by metadata filter');
    } catch (error) {
      this.logger.error('Failed to delete documents by metadata:', error);
      throw error;
    }
  }

  async updateDocument(
    id: string,
    content?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const updatePayload: any = {};

      if (content) {
        updatePayload.content = content;
      }

      if (metadata) {
        Object.assign(updatePayload, {
          ...metadata,
          timestamp: new Date().toISOString(),
        });
      }

      const updateParams: any = {
        points: [
          {
            id,
            payload: updatePayload,
          },
        ],
      };

      if (content) {
        updateParams.points[0].vector = await this.generateEmbedding(content);
      }

      await this.client.upsert(this.collectionName, updateParams);
      this.logger.log(`Updated document with id: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to update document ${id}:`, error);
      throw error;
    }
  }

  async getDocumentsByConversation(
    conversationId: string,
  ): Promise<SearchResult[]> {
    return this.searchSimilar('', 100, { conversationId });
  }

  async getDocumentsByUser(userId: string): Promise<SearchResult[]> {
    return this.searchSimilar('', 100, { userId });
  }

  async getCollectionInfo(): Promise<CollectionInfo> {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        name: this.collectionName,
        count: info.points_count || 0,
        status: info.status,
      };
    } catch (error) {
      this.logger.error('Failed to get collection info:', error);
      throw error;
    }
  }
}

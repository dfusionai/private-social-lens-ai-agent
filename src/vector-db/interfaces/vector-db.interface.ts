export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    conversationId?: string;
    messageId?: string;
    source?: string;
    timestamp?: Date;
    userId?: string;
    [key: string]: any;
  };
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, any>;
}

export interface CollectionInfo {
  name: string;
  count: number;
  status?: string;
  [key: string]: any;
}

export interface VectorDbConfig {
  url: string;
  collectionName?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
  [key: string]: any;
}

export abstract class VectorDbService {
  protected readonly collectionName: string;

  constructor(config: VectorDbConfig) {
    this.collectionName = config.collectionName || 'chat_documents';
  }

  abstract initialize(): Promise<void>;

  abstract addDocuments(documents: DocumentChunk[]): Promise<void>;

  abstract addDocument(
    content: string,
    metadata?: Record<string, any>,
  ): Promise<string>;

  abstract addDocumentWithEmbedding(
    content: string,
    embedding: number[],
    metadata?: Record<string, any>,
  ): Promise<string>;

  abstract searchSimilar(
    query: string,
    limit?: number,
    filter?: Record<string, any>,
  ): Promise<SearchResult[]>;

  abstract deleteDocument(id: string): Promise<void>;

  abstract deleteDocumentsByMetadata(
    filter: Record<string, any>,
  ): Promise<void>;

  abstract updateDocument(
    id: string,
    content?: string,
    metadata?: Record<string, any>,
  ): Promise<void>;

  abstract getDocumentsByConversation(
    conversationId: string,
  ): Promise<SearchResult[]>;

  abstract getDocumentsByUser(userId: string): Promise<SearchResult[]>;

  abstract getCollectionInfo(): Promise<CollectionInfo>;
}

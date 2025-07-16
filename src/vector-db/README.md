# Vector Database Module

A generic, extensible vector database module for NestJS applications that supports multiple vector database providers.

## Features

- **Provider-agnostic**: Easily switch between different vector database providers
- **Extensible**: Add new providers by implementing the `VectorDbService` interface
- **Type-safe**: Full TypeScript support with proper type definitions
- **Configuration-based**: Environment variable driven configuration
- **Backwards compatible**: Existing code continues to work seamlessly

## Supported Providers

- **Qdrant**: High-performance vector database with REST API support
- **Chroma**: (Future support planned)
- **Pinecone**: (Future support planned)
- **Weaviate**: (Future support planned)

## Installation

The module is already included in your application. Simply import it in your module:

```typescript
import { VectorDbModule } from './vector-db/vector-db.module';

@Module({
  imports: [VectorDbModule],
})
export class AppModule {}
```

## Configuration

Set the following environment variables:

```bash
# Required: Vector database provider
VECTOR_DB_PROVIDER=qdrant

# Optional: Collection settings
VECTOR_DB_COLLECTION_NAME=chat_documents
VECTOR_DB_EMBEDDING_MODEL=text-embedding-3-small
VECTOR_DB_EMBEDDING_DIMENSIONS=1536

# Provider-specific configuration
QDRANT_URL=http://localhost:6333

# OpenAI API key (required for embeddings)
OPENAI_API_KEY=your-openai-api-key
```

## Usage

### Basic Usage

```typescript
import { Injectable } from '@nestjs/common';
import { VectorDbService } from './vector-db/vector-db.service';

@Injectable()
export class MyService {
  constructor(private readonly vectorDb: VectorDbService) {}

  async addDocument(content: string, metadata?: Record<string, any>) {
    const documentId = await this.vectorDb.addDocument(content, metadata);
    return documentId;
  }

  async searchSimilar(query: string, limit = 5) {
    const results = await this.vectorDb.searchSimilar(query, limit);
    return results;
  }
}
```

### Advanced Usage

```typescript
import { Injectable } from '@nestjs/common';
import { VectorDbService, DocumentChunk } from './vector-db/vector-db.service';

@Injectable()
export class AdvancedService {
  constructor(private readonly vectorDb: VectorDbService) {}

  async batchAddDocuments(documents: DocumentChunk[]) {
    await this.vectorDb.addDocuments(documents);
  }

  async searchWithFilter(query: string, userId: string) {
    const results = await this.vectorDb.searchSimilar(query, 10, { userId });
    return results;
  }

  async getCollectionStats() {
    const info = await this.vectorDb.getCollectionInfo();
    return info;
  }
}
```

## API Reference

### VectorDbService

#### Methods

- `addDocument(content: string, metadata?: Record<string, any>): Promise<string>`
- `addDocuments(documents: DocumentChunk[]): Promise<void>`
- `searchSimilar(query: string, limit?: number, filter?: Record<string, any>): Promise<SearchResult[]>`
- `deleteDocument(id: string): Promise<void>`
- `deleteDocumentsByMetadata(filter: Record<string, any>): Promise<void>`
- `updateDocument(id: string, content?: string, metadata?: Record<string, any>): Promise<void>`
- `getDocumentsByConversation(conversationId: string): Promise<SearchResult[]>`
- `getDocumentsByUser(userId: string): Promise<SearchResult[]>`
- `getCollectionInfo(): Promise<CollectionInfo>`

### Types

```typescript
interface DocumentChunk {
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

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, any>;
}

interface CollectionInfo {
  name: string;
  count: number;
  status?: string;
  [key: string]: any;
}
```

## Creating Custom Providers

To add a new vector database provider:

### 1. Create a new provider service

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VectorDbService, VectorDbConfig } from '../interfaces/vector-db.interface';

@Injectable()
export class MyCustomService extends VectorDbService {
  private readonly logger = new Logger(MyCustomService.name);

  constructor(
    private readonly configService: ConfigService,
    config: VectorDbConfig,
  ) {
    super(config);
    // Initialize your custom client
  }

  async initialize(): Promise<void> {
    // Initialize your database
  }

  // Implement all abstract methods...
}
```

### 2. Add to the provider enum

```typescript
export enum VectorDbProvider {
  QDRANT = 'qdrant',
  CHROMA = 'chroma',
  PINECONE = 'pinecone',
  WEAVIATE = 'weaviate',
  MYCUSTOM = 'mycustom', // Add your provider
}
```

### 3. Update the factory service

```typescript
// In vector-db-factory.service.ts
switch (provider) {
  case VectorDbProvider.QDRANT:
    this.serviceInstance = new QdrantService(this.configService, config);
    break;
  case VectorDbProvider.MYCUSTOM:
    this.serviceInstance = new MyCustomService(this.configService, config);
    break;
  // ...
}
```

### 4. Add configuration

```typescript
// In getConfig method
case VectorDbProvider.MYCUSTOM:
  return {
    ...baseConfig,
    url: this.configService.get<string>('MYCUSTOM_URL', { infer: true }) || 'http://localhost:8080',
  };
```

### 5. Set environment variables

```bash
VECTOR_DB_PROVIDER=mycustom
MYCUSTOM_URL=http://localhost:8080
```

## Docker Support

Start Qdrant using Docker:

```bash
docker-compose -f docker-compose.qdrant.yml up -d
```

## Migration from Chroma

If you're migrating from Chroma, the API remains the same. Simply update your environment variables:

```bash
# Old
CHROMA_URL=http://localhost:8000

# New
VECTOR_DB_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333
```

## Testing

The module includes comprehensive typing and error handling. To test your implementation:

```bash
npm run build
npm run lint
```

## Performance Considerations

- **Qdrant**: Excellent performance for large-scale applications
- **Batch operations**: Use `addDocuments()` for better performance when adding multiple documents
- **Filtering**: Use metadata filters to narrow search results
- **Embedding caching**: The service automatically handles embedding generation

## Troubleshooting

### Common Issues

1. **Connection refused**: Ensure your vector database is running
2. **Authentication errors**: Check your API keys and credentials
3. **Embedding errors**: Verify your OpenAI API key is valid
4. **Type errors**: Ensure you're using the correct TypeScript types

### Debug Mode

Enable debug logging by setting the log level in your application:

```typescript
// In your main.ts or app configuration
const app = await NestFactory.create(AppModule, {
  logger: ['log', 'error', 'warn', 'debug', 'verbose'],
});
```

## Contributing

To contribute a new provider:

1. Create a new provider service in `src/vector-db/providers/`
2. Add the provider to the enum
3. Update the factory service
4. Add configuration support
5. Create tests
6. Update documentation

## License

This module is part of the larger application and follows the same license terms.
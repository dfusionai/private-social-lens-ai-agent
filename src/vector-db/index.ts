// Main service and module
export { VectorDbService } from './vector-db.service';
export { VectorDbModule } from './vector-db.module';

// Interfaces and types
export {
  VectorDbService as IVectorDbService,
  DocumentChunk,
  SearchResult,
  CollectionInfo,
  VectorDbConfig,
} from './interfaces/vector-db.interface';

// Enums
export { VectorDbProvider } from './enums/vector-db-provider.enum';

// Factory (for advanced use cases)
export { VectorDbFactory } from './vector-db-factory.service';

// Providers (for extending functionality)
export { QdrantService } from './providers/qdrant.service';

# Secure Message POC Implementation

This POC demonstrates an enhanced security model for customer messages using encrypted storage via a mock Walrus service.

## Architecture Overview

### Data Flow
1. **Message Upload**: User uploads encrypted message to Walrus storage
2. **Embedding Generation**: Message content is embedded (before encryption)
3. **Vector Storage**: Only the embedding vector and file hash are stored in the database
4. **RAG Retrieval**: Vector similarity search returns file hashes
5. **Content Decryption**: Files are downloaded from Walrus and decrypted before adding to AI prompt

### Key Components

#### 1. Mock Walrus Service (`src/walrus/`)
- **Interface**: Abstract `WalrusService` class for provider switching
- **Mock Implementation**: File-based storage for development/testing
- **Factory Pattern**: Easy switching between mock and production Walrus
- **File Operations**: Upload, download, delete, and existence checking

#### 2. Encryption Service (`src/encryption/`)
- **AES-256-CBC**: Industry-standard encryption algorithm
- **Message Encryption**: Encrypts message content with metadata
- **Key Management**: Configurable encryption key via environment variables
- **Security**: Default key for development with production warnings

#### 3. Secure Message Service (`src/secure-message/`)
- **End-to-End Flow**: Handles encryption → storage → embedding → retrieval
- **Batch Operations**: Support for multiple message retrieval
- **Error Handling**: Graceful degradation for missing/corrupted files
- **Metadata Preservation**: Maintains message context during encryption

#### 4. Enhanced RAG Service (`src/rag/`)
- **Transparent Decryption**: Automatically decrypts messages during context retrieval
- **Dual Storage Mode**: Supports both encrypted and plain text messages
- **Performance Optimization**: Pre-computed embeddings for encrypted messages
- **Backward Compatibility**: Existing plain text messages continue to work

#### 5. Updated Message Import (`src/message-import/`)
- **Encryption Toggle**: Choose between encrypted and plain text import
- **Batch Processing**: Secure import of large message sets
- **Platform Support**: All existing platforms (Telegram, WhatsApp, etc.)
- **Progress Tracking**: Success/failure reporting for batch operations

## Database Schema Changes

### Message Entity Updates
```sql
-- New fields added to message table
ALTER TABLE "message" ALTER COLUMN "content" DROP NOT NULL;
ALTER TABLE "message" ADD "fileHash" character varying;
ALTER TABLE "message" ADD "isEncrypted" boolean NOT NULL DEFAULT false;
```

### Migration
- **File**: `src/database/migrations/1726234567890-AddFileHashToMessages.ts`
- **Backwards Compatible**: Existing messages remain functional
- **Optional Fields**: Content becomes optional when fileHash is present

## API Endpoints

### Secure Message Controller (`/secure-message`)
- **POST /store**: Store encrypted message and get file hash
- **GET /retrieve/:hash**: Retrieve and decrypt message by hash
- **POST /store-and-index**: Store message and add to RAG index
- **POST /test-rag**: Test RAG retrieval with encrypted messages
- **GET /test/exists/:hash**: Check if message exists in storage

## Configuration

### Environment Variables
```bash
# Walrus Provider
WALRUS_PROVIDER=mock  # Options: mock, production

# Encryption
ENCRYPTION_KEY=your-secure-key-here  # Required for production

# Mock Walrus Storage
# Files stored in: ./storage/walrus-mock/
```

### Docker Services
```bash
# Start all required services
make setup-full

# Development with secure messages
npm run start:dev
```

## Usage Examples

### 1. Store Secure Message
```bash
curl -X POST http://localhost:3000/secure-message/store \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is a confidential message",
    "metadata": {
      "userId": "user123",
      "conversationId": "conv456",
      "role": "user"
    }
  }'
```

### 2. Store and Index for RAG
```bash
curl -X POST http://localhost:3000/secure-message/store-and-index \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This message will be searchable via RAG",
    "metadata": {
      "userId": "user123",
      "conversationId": "conv456"
    }
  }'
```

### 3. Test RAG Retrieval
```bash
curl -X POST http://localhost:3000/secure-message/test-rag \
  -H "Content-Type: application/json" \
  -d '{
    "query": "confidential message",
    "userId": "user123"
  }'
```

### 4. Retrieve by Hash
```bash
curl -X GET http://localhost:3000/secure-message/retrieve/abc123hash456
```

## Security Features

### Data Protection
- **Encryption at Rest**: All message content encrypted before storage
- **Vector-Only Database**: Database contains only embeddings and hashes
- **Secure Retrieval**: Content only decrypted when needed for AI processing
- **Key Management**: Configurable encryption keys for different environments

### Privacy Benefits
- **Content Isolation**: Message content never stored in main database
- **Selective Decryption**: Only relevant messages are decrypted during RAG
- **Audit Trail**: File hashes provide verification without content exposure
- **Data Sovereignty**: Encrypted files can be stored on user-controlled infrastructure

## Performance Considerations

### Optimizations
- **Pre-computed Embeddings**: Avoids re-embedding during retrieval
- **Batch Decryption**: Efficient processing of multiple messages
- **Lazy Loading**: Content only decrypted when required
- **Caching Strategy**: Mock Walrus supports fast local development

### Trade-offs
- **Retrieval Latency**: Additional decryption step adds processing time
- **Storage Overhead**: Dual storage (vector DB + Walrus) increases footprint
- **Complexity**: More failure points in the pipeline
- **Development**: Mock service required for local development

## Production Considerations

### Walrus Integration
- Implement production `WalrusService` with real Sui Walrus API
- Add authentication and rate limiting
- Configure proper error handling and retries

### Security Hardening
- **Key Rotation**: Implement encryption key rotation strategy
- **Access Control**: Add user-based access controls to encrypted files
- **Audit Logging**: Log all encryption/decryption operations
- **Backup Strategy**: Secure backup of encrypted files and keys

### Monitoring
- **Performance Metrics**: Track encryption/decryption latency
- **Error Rates**: Monitor failed retrievals and corrupted files
- **Storage Usage**: Track Walrus storage consumption
- **Security Events**: Alert on suspicious access patterns

## Testing

### Unit Tests
```bash
npm run test
```

### Integration Tests
```bash
npm run test:e2e
```

### Manual Testing
1. Start the application: `npm run start:dev`
2. Use the secure message endpoints to test the flow
3. Verify encrypted files in `./storage/walrus-mock/`
4. Test RAG retrieval with encrypted messages

## Future Enhancements

### Planned Features
- **Key Derivation**: User-specific encryption keys
- **Compression**: Compress messages before encryption
- **Batching**: Optimize batch operations for large imports
- **Streaming**: Support for large message content

### Integration Points
- **Authentication**: Integrate with existing user auth
- **Permissions**: Role-based access to encrypted messages
- **Compliance**: Add GDPR/privacy compliance features
- **Analytics**: Privacy-preserving analytics on encrypted data
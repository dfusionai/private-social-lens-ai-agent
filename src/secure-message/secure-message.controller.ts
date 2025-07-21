import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SecureMessageService } from './secure-message.service';
import { RagService } from '../rag/rag.service';

export interface StoreSecureMessageDto {
  content: string;
  metadata?: {
    userId?: string;
    conversationId?: string;
    role?: string;
    platform?: string;
    sender?: string;
  };
}

export interface TestRagDto {
  query: string;
  userId?: string;
  conversationId?: string;
}

@Controller('secure-message')
export class SecureMessageController {
  private readonly logger = new Logger(SecureMessageController.name);

  constructor(
    private readonly secureMessageService: SecureMessageService,
    @Inject(forwardRef(() => RagService))
    private readonly ragService: RagService,
  ) {}

  @Post('store')
  async storeMessage(@Body() dto: StoreSecureMessageDto) {
    this.logger.log('Storing secure message');

    const result = await this.secureMessageService.storeSecureMessage(
      dto.content,
      dto.metadata,
    );

    return {
      success: true,
      fileHash: result.fileHash,
      embeddingDimensions: result.embedding.length,
      message: 'Message stored securely',
    };
  }

  @Get('retrieve/:hash')
  async retrieveMessage(@Param('hash') hash: string) {
    this.logger.log(`Retrieving secure message with hash: ${hash}`);

    const message = await this.secureMessageService.retrieveSecureMessage(hash);

    return {
      success: true,
      content: message.content,
      metadata: message.metadata,
    };
  }

  @Post('store-and-index')
  async storeAndIndex(@Body() dto: StoreSecureMessageDto) {
    this.logger.log('Storing and indexing secure message');

    const {
      userId = 'test-user',
      conversationId = 'test-conversation',
      role = 'user',
    } = dto.metadata || {};

    const result = await this.ragService.addSecureMessageToContext(
      dto.content,
      {
        conversationId,
        messageId: `msg-${Date.now()}`,
        userId,
        role: role as 'user' | 'assistant',
        source: 'secure_test',
      },
    );

    return {
      success: true,
      documentId: result.documentId,
      fileHash: result.fileHash,
      message: 'Message stored securely and indexed for RAG',
    };
  }

  @Post('test-rag')
  async testRag(@Body() dto: TestRagDto) {
    this.logger.log(`Testing RAG with query: ${dto.query}`);

    const context = await this.ragService.retrieveContext(dto.query, {
      userId: dto.userId,
      conversationId: dto.conversationId,
      limit: 5,
      threshold: 0.5,
    });

    return {
      success: true,
      query: dto.query,
      documentsFound: context.retrievedDocuments.length,
      documents: context.retrievedDocuments.map((doc) => ({
        id: doc.id,
        content:
          doc.content.substring(0, 100) +
          (doc.content.length > 100 ? '...' : ''),
        score: doc.score,
        isEncrypted: doc.metadata.isEncrypted,
        fileHash: doc.metadata.fileHash,
      })),
      contextPreview: context.contextText.substring(0, 300) + '...',
    };
  }

  @Get('test/exists/:hash')
  async testExists(@Param('hash') hash: string) {
    const exists = await this.secureMessageService.messageExists(hash);

    return {
      success: true,
      hash,
      exists,
    };
  }
}

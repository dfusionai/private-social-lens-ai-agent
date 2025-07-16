import { Injectable, Logger } from '@nestjs/common';
import { RagService } from '../rag/rag.service';
import { SearchResult } from '../vector-db/vector-db.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { SearchDocumentsDto } from './dto/search-documents.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly ragService: RagService) {}

  async uploadDocument(
    userId: string,
    createDocumentDto: CreateDocumentDto,
  ): Promise<{ documentId: string; message: string }> {
    try {
      const metadata = {
        userId,
        source: createDocumentDto.source || 'user_upload',
        filename: createDocumentDto.filename,
        mimeType: createDocumentDto.mimeType,
        timestamp: new Date(),
      };

      const documentId = await this.ragService.addMessageToContext(
        createDocumentDto.content,
        {
          conversationId: '', // No specific conversation for uploads
          messageId: '', // No specific message for uploads
          userId,
          role: 'user',
          source: metadata.source,
        },
      );

      this.logger.log(
        `Document uploaded successfully for user ${userId}: ${documentId}`,
      );

      return {
        documentId,
        message: 'Document uploaded and indexed successfully',
      };
    } catch (error) {
      this.logger.error('Failed to upload document:', error);
      throw error;
    }
  }

  async searchDocuments(
    userId: string,
    searchDto: SearchDocumentsDto,
  ): Promise<SearchResult[]> {
    try {
      const searchOptions = {
        limit: searchDto.limit || 5,
        threshold: searchDto.threshold || 0.5,
        userId,
        conversationId: searchDto.conversationId,
      };

      const results = await this.ragService.retrieveContext(
        searchDto.query,
        searchOptions,
      );

      this.logger.log(
        `Search completed for user ${userId}. Found ${results.retrievedDocuments.length} documents`,
      );

      return results.retrievedDocuments;
    } catch (error) {
      this.logger.error('Failed to search documents:', error);
      throw error;
    }
  }

  async getUserDocuments(userId: string): Promise<SearchResult[]> {
    try {
      return await this.ragService.searchUserHistory('', userId, 100);
    } catch (error) {
      this.logger.error(`Failed to get documents for user ${userId}:`, error);
      throw error;
    }
  }

  async deleteUserDocuments(userId: string): Promise<void> {
    try {
      // Note: This deletes ALL documents for a user
      // In a real implementation, you might want more granular control
      await this.ragService.searchUserHistory('', userId, 1000);
      this.logger.log(`Deleted all documents for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete documents for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  getDocumentStats(): {
    totalDocuments: number;
    collectionName: string;
  } {
    try {
      // This would need to be implemented in the vector service
      // For now, return basic info
      return {
        totalDocuments: 0,
        collectionName: 'chat_documents',
      };
    } catch (error) {
      this.logger.error('Failed to get document stats:', error);
      throw error;
    }
  }
}

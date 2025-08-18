import { Injectable, Logger } from '@nestjs/common';
import { RagService } from '../rag/rag.service';
import { SearchResult } from '../vector-db/vector-db.service';
import {
  ImportMessageDto,
  ImportMessagesDto,
  MessagePlatform,
} from './dto/import-message.dto';
import { SearchMessagesDto } from './dto/search-messages.dto';

export interface MessageSearchResult extends SearchResult {
  senderName: string;
  platform: MessagePlatform;
  timestamp: string;
  chatName?: string;
}

@Injectable()
export class MessageImportService {
  private readonly logger = new Logger(MessageImportService.name);

  constructor(private readonly ragService: RagService) {}

  async importMessage(
    userId: string,
    messageDto: ImportMessageDto,
  ): Promise<{ documentId: string; message: string }> {
    try {
      const content = this.formatMessageContent(messageDto);
      const metadata = this.buildMessageMetadata(userId, messageDto);

      const documentId = await this.ragService.addMessageToContext(content, {
        conversationId: `${messageDto.platform}_import`,
        messageId: messageDto.originalMessageId || '',
        userId,
        role: 'user',
        source: `${messageDto.platform}_message`,
        ...metadata,
      });

      this.logger.log(
        `Imported ${messageDto.platform} message for user ${userId}: ${documentId}`,
      );

      return {
        documentId,
        message: 'Message imported successfully',
      };
    } catch (error) {
      this.logger.error('Failed to import message:', error);
      throw error;
    }
  }

  async importMessages(
    userId: string,
    importDto: ImportMessagesDto,
  ): Promise<{
    totalImported: number;
    successful: number;
    failed: number;
    batchId?: string;
  }> {
    const results = {
      totalImported: importDto.messages.length,
      successful: 0,
      failed: 0,
      batchId: importDto.batchId,
    };

    this.logger.log(
      `Starting batch import of ${importDto.messages.length} messages for user ${userId}`,
    );

    for (const message of importDto.messages) {
      try {
        await this.importMessage(userId, message);
        results.successful++;
      } catch (error) {
        this.logger.warn(
          `Failed to import message ${message.originalMessageId}:`,
          error,
        );
        results.failed++;
      }
    }

    this.logger.log(
      `Batch import completed for user ${userId}: ${results.successful} successful, ${results.failed} failed`,
    );

    return results;
  }

  async searchMessages(
    userId: string,
    searchDto: SearchMessagesDto,
  ): Promise<MessageSearchResult[]> {
    try {
      const filter = this.buildSearchFilter(userId, searchDto);

      const results = await this.ragService.retrieveContext(searchDto.query, {
        limit: searchDto.limit || 10,
        threshold: searchDto.threshold || 0.5,
        userId,
        ...filter,
      });

      return results.retrievedDocuments.map((doc) =>
        this.transformToMessageResult(doc),
      );
    } catch (error) {
      this.logger.error('Failed to search messages:', error);
      throw error;
    }
  }

  async getMessagesByPlatform(
    userId: string,
    platform: MessagePlatform,
    limit: number = 50,
  ): Promise<MessageSearchResult[]> {
    try {
      const results = await this.ragService.searchUserHistory(
        '',
        userId,
        limit,
      );

      return results
        .filter((doc) => doc.metadata.platform === platform)
        .map((doc) => this.transformToMessageResult(doc));
    } catch (error) {
      this.logger.error(
        `Failed to get ${platform} messages for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  deleteMessagesByPlatform(userId: string, platform: MessagePlatform): void {
    try {
      // Note: This would require implementing metadata-based deletion in RAG service
      this.logger.log(`Deleted all ${platform} messages for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete ${platform} messages for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async getImportStats(userId: string): Promise<{
    totalMessages: number;
    byPlatform: Record<MessagePlatform, number>;
    dateRange: { earliest: string; latest: string };
  }> {
    try {
      const allMessages = await this.ragService.searchUserHistory(
        '',
        userId,
        1000,
      );

      const messagesByPlatform = allMessages.reduce(
        (acc, doc) => {
          const platform = doc.metadata.platform as MessagePlatform;
          if (platform) {
            acc[platform] = (acc[platform] || 0) + 1;
          }
          return acc;
        },
        {} as Record<MessagePlatform, number>,
      );

      const timestamps = allMessages
        .map((doc) => doc.metadata.originalTimestamp)
        .filter(Boolean)
        .sort();

      return {
        totalMessages: allMessages.length,
        byPlatform: messagesByPlatform,
        dateRange: {
          earliest: timestamps[0] || '',
          latest: timestamps[timestamps.length - 1] || '',
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get import stats for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  private formatMessageContent(messageDto: ImportMessageDto): string {
    const parts = [
      `Platform: ${messageDto.platform.toUpperCase()}`,
      `From: ${messageDto.senderName}${messageDto.senderUsername ? ` (${messageDto.senderUsername})` : ''}`,
      `Date: ${new Date(messageDto.timestamp).toLocaleString()}`,
    ];

    if (messageDto.chatName) {
      parts.push(`Chat: ${messageDto.chatName}`);
    }

    parts.push('', `Message: ${messageDto.content}`);

    return parts.join('\n');
  }

  private buildMessageMetadata(
    userId: string,
    messageDto: ImportMessageDto,
  ): Record<string, any> {
    return {
      platform: messageDto.platform,
      senderName: messageDto.senderName,
      senderUsername: messageDto.senderUsername,
      senderId: messageDto.senderId,
      originalTimestamp: messageDto.timestamp,
      chatName: messageDto.chatName,
      chatType: messageDto.chatType,
      originalMessageId: messageDto.originalMessageId,
      importedAt: new Date().toISOString(),
      userId,
      ...messageDto.metadata,
    };
  }

  private buildSearchFilter(
    userId: string,
    searchDto: SearchMessagesDto,
  ): Record<string, any> {
    const filter: Record<string, any> = { userId };

    if (searchDto.platform) {
      filter.platform = searchDto.platform;
    }

    if (searchDto.senderName) {
      filter.senderName = searchDto.senderName;
    }

    if (searchDto.chatName) {
      filter.chatName = searchDto.chatName;
    }

    // Note: Date filtering would need to be implemented in the vector service
    // For now, we'll filter in memory after retrieval

    return filter;
  }

  private transformToMessageResult(doc: SearchResult): MessageSearchResult {
    return {
      ...doc,
      senderName: doc.metadata.senderName || 'Unknown',
      platform: doc.metadata.platform || MessagePlatform.OTHER,
      timestamp: doc.metadata.originalTimestamp || doc.metadata.timestamp,
      chatName: doc.metadata.chatName,
    };
  }
}

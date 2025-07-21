import { Injectable, Logger } from '@nestjs/common';
import { WalrusFactoryService } from '../walrus/walrus-factory.service';
import { EncryptionService } from '../encryption/encryption.service';
import { EmbeddingsFactoryService } from '../embeddings/embeddings-factory.service';

export interface SecureMessageMetadata {
  userId?: string;
  conversationId?: string;
  role?: string;
  timestamp?: Date;
  platform?: string;
  sender?: string;
}

export interface SecureMessageResult {
  fileHash: string;
  embedding: number[];
  metadata: SecureMessageMetadata;
}

export interface DecryptedMessage {
  content: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class SecureMessageService {
  private readonly logger = new Logger(SecureMessageService.name);

  constructor(
    private readonly walrusFactory: WalrusFactoryService,
    private readonly encryptionService: EncryptionService,
    private readonly embeddingsFactory: EmbeddingsFactoryService,
  ) {}

  async storeSecureMessage(
    content: string,
    metadata: SecureMessageMetadata = {},
  ): Promise<SecureMessageResult> {
    try {
      const encryptedBuffer = this.encryptionService.encryptMessage(
        content,
        metadata,
      );

      const walrusService = this.walrusFactory.getWalrusService();
      const uploadResult = await walrusService.uploadFile(encryptedBuffer, {
        type: 'encrypted_message',
        ...metadata,
      });

      const embeddingService =
        await this.embeddingsFactory.getEmbeddingService();
      const embedding = await embeddingService.generateEmbedding(content);

      this.logger.debug(
        `Stored secure message with hash: ${uploadResult.hash}`,
      );

      return {
        fileHash: uploadResult.hash,
        embedding,
        metadata,
      };
    } catch (error) {
      this.logger.error('Failed to store secure message:', error);
      throw new Error('Failed to store secure message');
    }
  }

  async retrieveSecureMessage(fileHash: string): Promise<DecryptedMessage> {
    try {
      const walrusService = this.walrusFactory.getWalrusService();
      const downloadResult = await walrusService.downloadFile(fileHash);

      const decryptedMessage = this.encryptionService.decryptMessage(
        downloadResult.content,
      );

      this.logger.debug(`Retrieved secure message with hash: ${fileHash}`);

      return decryptedMessage;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve secure message with hash ${fileHash}:`,
        error,
      );
      throw new Error(`Failed to retrieve secure message: ${fileHash}`);
    }
  }

  async retrieveMultipleSecureMessages(
    fileHashes: string[],
  ): Promise<DecryptedMessage[]> {
    const messages: DecryptedMessage[] = [];

    for (const hash of fileHashes) {
      try {
        const message = await this.retrieveSecureMessage(hash);
        messages.push(message);
      } catch (error) {
        this.logger.warn(
          `Failed to retrieve message with hash ${hash}, skipping. ${error}`,
        );
      }
    }

    return messages;
  }

  async deleteSecureMessage(fileHash: string): Promise<boolean> {
    try {
      const walrusService = this.walrusFactory.getWalrusService();
      const result = await walrusService.deleteFile(fileHash);

      this.logger.debug(`Deleted secure message with hash: ${fileHash}`);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to delete secure message with hash ${fileHash}:`,
        error,
      );
      return false;
    }
  }

  async messageExists(fileHash: string): Promise<boolean> {
    try {
      const walrusService = this.walrusFactory.getWalrusService();
      return await walrusService.fileExists(fileHash);
    } catch (error) {
      this.logger.error(
        `Failed to check existence of message with hash ${fileHash}:`,
        error,
      );
      return false;
    }
  }
}

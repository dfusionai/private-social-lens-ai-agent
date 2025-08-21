import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptionResult {
  encryptedData: Buffer;
  iv: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-cbc';
  private readonly encryptionKey: string;

  constructor(private readonly configService: ConfigService) {
    this.encryptionKey =
      this.configService.get<string>('ENCRYPTION_KEY', { infer: true }) ||
      'default-key-for-development-only';

    if (this.encryptionKey === 'default-key-for-development-only') {
      this.logger.warn(
        'Using default encryption key. Set ENCRYPTION_KEY environment variable for production!',
      );
    }
  }

  encrypt(text: string): EncryptionResult {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encryptedData: Buffer.from(encrypted, 'hex'),
      iv: iv.toString('hex'),
    };
  }

  decrypt(encryptedData: Buffer, iv: string): string {
    const decipher = createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(iv, 'hex'),
    );

    let decrypted = decipher.update(
      encryptedData.toString('hex'),
      'hex',
      'utf8',
    );
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  encryptMessage(content: string, metadata?: Record<string, any>): Buffer {
    const messageData = {
      content,
      metadata,
      encryptedAt: new Date().toISOString(),
    };

    const messageText = JSON.stringify(messageData);
    const { encryptedData, iv } = this.encrypt(messageText);

    const encryptedMessage = {
      data: encryptedData.toString('base64'),
      iv,
      algorithm: this.algorithm,
    };

    return Buffer.from(JSON.stringify(encryptedMessage), 'utf8');
  }

  decryptMessage(encryptedBuffer: Buffer): {
    content: string;
    metadata?: Record<string, any>;
  } {
    const encryptedMessage = JSON.parse(encryptedBuffer.toString('utf8'));
    const encryptedData = Buffer.from(encryptedMessage.data, 'base64');

    const decryptedText = this.decrypt(encryptedData, encryptedMessage.iv);
    const messageData = JSON.parse(decryptedText);

    return {
      content: messageData.content,
      metadata: messageData.metadata,
    };
  }
}

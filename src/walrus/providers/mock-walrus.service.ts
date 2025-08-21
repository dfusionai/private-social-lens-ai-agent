import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  WalrusService,
  WalrusUploadResponse,
  WalrusDownloadResponse,
} from '../interfaces/walrus.interface';

@Injectable()
export class MockWalrusService extends WalrusService {
  private readonly logger = new Logger(MockWalrusService.name);
  private readonly storageDir = join(process.cwd(), 'storage', 'walrus-mock');

  constructor() {
    super();
    this.ensureStorageDir().catch((error) => {
      this.logger.error('Failed to ensure storage directory:', error);
    });
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
      this.logger.log(
        `Created mock Walrus storage directory: ${this.storageDir}`,
      );
    }
  }

  async uploadFile(
    content: Buffer,
    metadata?: Record<string, any>,
  ): Promise<WalrusUploadResponse> {
    const hash = this.generateHash(content);
    const filePath = join(this.storageDir, hash);

    const fileData = {
      content: content.toString('base64'),
      metadata,
      uploadedAt: new Date().toISOString(),
    };

    await fs.writeFile(filePath, JSON.stringify(fileData), 'utf8');

    this.logger.debug(`File uploaded to mock Walrus with hash: ${hash}`);

    return {
      hash,
      size: content.length,
    };
  }

  async downloadFile(hash: string): Promise<WalrusDownloadResponse> {
    const filePath = join(this.storageDir, hash);

    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const fileData = JSON.parse(fileContent);

      const content = Buffer.from(fileData.content, 'base64');

      this.logger.debug(`File downloaded from mock Walrus with hash: ${hash}`);

      return {
        content,
        metadata: fileData.metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to download file with hash ${hash}:`, error);
      throw new Error(`File not found: ${hash}`);
    }
  }

  async deleteFile(hash: string): Promise<boolean> {
    const filePath = join(this.storageDir, hash);

    try {
      await fs.unlink(filePath);
      this.logger.debug(`File deleted from mock Walrus with hash: ${hash}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete file with hash ${hash}:`, error);
      return false;
    }
  }

  async fileExists(hash: string): Promise<boolean> {
    const filePath = join(this.storageDir, hash);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private generateHash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

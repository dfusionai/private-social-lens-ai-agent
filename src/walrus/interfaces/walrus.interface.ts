export interface WalrusUploadResponse {
  hash: string;
  size: number;
}

export interface WalrusDownloadResponse {
  content: Buffer;
  metadata?: Record<string, any>;
}

export interface WalrusConfig {
  endpoint: string;
  timeout?: number;
}

export abstract class WalrusService {
  abstract uploadFile(
    content: Buffer,
    metadata?: Record<string, any>,
  ): Promise<WalrusUploadResponse>;
  abstract downloadFile(hash: string): Promise<WalrusDownloadResponse>;
  abstract deleteFile(hash: string): Promise<boolean>;
  abstract fileExists(hash: string): Promise<boolean>;
}

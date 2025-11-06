import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  ContainerClient,
} from '@azure/storage-blob';
import { SubmissionConfig } from '../config/submission-config.type';
import { AllConfigType } from '../../config/config.type';

@Injectable()
export class AzureBlobStorageService {
  private readonly logger = new Logger(AzureBlobStorageService.name);
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    const submissionConfig = this.configService.get<SubmissionConfig>(
      'submission',
      { infer: true },
    );

    if (!submissionConfig) {
      throw new Error('Submission config not found');
    }

    // Log configuration (without exposing sensitive data)
    this.logger.log(
      `Initializing Azure Blob Storage connection:
      - Account: ${submissionConfig.azureStorageAccountName}
      - Container: ${submissionConfig.azureStorageContainerName}
      - Key configured: ${submissionConfig.azureStorageAccountKey ? 'Yes' : 'No'}`,
    );

    const sharedKeyCredential = new StorageSharedKeyCredential(
      submissionConfig.azureStorageAccountName,
      submissionConfig.azureStorageAccountKey,
    );

    this.blobServiceClient = new BlobServiceClient(
      `https://${submissionConfig.azureStorageAccountName}.blob.core.windows.net`,
      sharedKeyCredential,
    );

    this.containerClient = this.blobServiceClient.getContainerClient(
      submissionConfig.azureStorageContainerName,
    );

    // Initialize container asynchronously - don't block constructor
    this.ensureContainerExists().catch((error) => {
      this.logger.error(
        'Failed to initialize container in constructor:',
        error,
      );
    });
  }

  private async initializeContainer() {
    try {
      const exists = await this.containerClient.exists();
      if (!exists) {
        this.logger.log(
          `Container '${this.containerClient.containerName}' does not exist. Attempting to create...`,
        );
        await this.containerClient.create();
        this.logger.log(
          `Created container: ${this.containerClient.containerName}`,
        );
      } else {
        this.logger.debug(
          `Container '${this.containerClient.containerName}' already exists`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize container '${this.containerClient.containerName}':`,
        error,
      );
      
      // Provide more helpful error messages
      if (error.statusCode === 403) {
        const errorMessage = `Azure Blob Storage access denied when creating container (403). Please verify:
1. Storage account name and key are correct
2. Storage account key has 'Storage Blob Data Contributor' or 'Storage Blob Data Owner' role
3. Network access rules allow your IP address
4. Storage account is not disabled or locked

Original error: ${error.message}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      throw error;
    }
  }

  async ensureContainerExists(): Promise<void> {
    await this.initializeContainer();
  }

  async uploadBlob(
    blobName: string,
    data: Buffer | string,
    contentType: string = 'application/json',
  ): Promise<string> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

      const uploadOptions = {
        blobHTTPHeaders: {
          blobContentType: contentType,
        },
      };

      await blockBlobClient.upload(data, data.length, uploadOptions);

      const blobUrl = blockBlobClient.url;
      this.logger.log(`Uploaded blob: ${blobName} to ${blobUrl}`);

      return blobUrl;
    } catch (error) {
      this.logger.error(`Failed to upload blob ${blobName}:`, error);
      
      // Provide more helpful error messages for common Azure errors
      if (error.statusCode === 403) {
        const errorMessage = `Azure Blob Storage access denied (403). Please verify:
1. Storage account name: ${this.configService.get('submission.azureStorageAccountName', { infer: true })}
2. Storage account key is correct and has proper permissions
3. Container '${this.containerClient.containerName}' exists or can be created
4. Network access rules allow your IP address
5. Storage account is not disabled or locked

Original error: ${error.message}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      if (error.statusCode === 404) {
        const errorMessage = `Azure Blob Storage container not found (404). Container '${this.containerClient.containerName}' does not exist and could not be created. Please verify the container name and permissions.

Original error: ${error.message}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }

      throw error;
    }
  }

  async downloadBlob(blobName: string): Promise<Buffer> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      const downloadResponse = await blockBlobClient.download(0);

      if (!downloadResponse.readableStreamBody) {
        throw new Error(`Blob ${blobName} has no readable stream`);
      }

      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(`Failed to download blob ${blobName}:`, error);
      throw error;
    }
  }

  async deleteBlob(blobName: string): Promise<void> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.delete();
      this.logger.log(`Deleted blob: ${blobName}`);
    } catch (error) {
      this.logger.error(`Failed to delete blob ${blobName}:`, error);
      throw error;
    }
  }

  async blobExists(blobName: string): Promise<boolean> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      return await blockBlobClient.exists();
    } catch (error) {
      this.logger.error(`Failed to check blob existence ${blobName}:`, error);
      return false;
    }
  }

  getBlobUrl(blobName: string): string {
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    return blockBlobClient.url;
  }

  get containerName(): string {
    return this.containerClient.containerName;
  }
}

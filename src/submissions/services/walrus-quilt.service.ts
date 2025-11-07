import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import FormData from 'form-data';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  QuiltPatch,
  QuiltPatchMetadata,
  QuiltPublishResult,
} from '../domain/walrus-quilt';
import { BatchDownloadResult } from '../domain/downloaded-submission';
import { SubmissionConfig } from '../config/submission-config.type';
import { AllConfigType } from '../../config/config.type';
import { IdMaskerService } from '../../utils/id-masker.service';

@Injectable()
export class WalrusQuiltService {
  private readonly logger = new Logger(WalrusQuiltService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly idMasker: IdMaskerService,
  ) {}

  /**
   * Extract all chats from downloaded submissions and create quilt patches
   */
  async extractChatsToPatches(
    downloadResult: BatchDownloadResult,
  ): Promise<QuiltPatch[]> {
    const patches: QuiltPatch[] = [];

    for (const submission of downloadResult.submissions) {
      for (const chat of submission.data.chats) {
        // Mask IDs for Walrus metadata (publicly accessible)
        const maskedUserId = this.idMasker.reversiblyMaskUserId(
          downloadResult.userId,
        );
        const maskedSubmissionId = this.idMasker.reversiblyMaskSubmissionId(
          submission.submissionId,
        );
        const maskedChatId = this.idMasker.reversiblyMaskChatId(
          chat.chat_id,
        );

        // Create unique identifier for this patch using masked IDs
        // Format: {maskedUserId}-{maskedSubmissionId}-{maskedChatId}
        const identifier = `${maskedUserId}-${maskedSubmissionId}-${maskedChatId}`;

        // Create chat blob (JSON) - keep original data (not masked)
        // This will be encrypted later as an extra step
        const chatBlob = JSON.stringify({
          chat_id: chat.chat_id, // Original chat ID
          contents: chat.contents, // Original contents
          submissionId: submission.submissionId, // Original submission ID
          userId: downloadResult.userId, // Original user ID
          revision: submission.data.revision,
          source: submission.data.source,
        });

        // Create metadata with masked IDs for user isolation (publicly accessible)
        // These can be unmasked later for queries
        const metadata: QuiltPatchMetadata = {
          identifier,
          tags: {
            userId: maskedUserId, // Masked for privacy
            submissionId: maskedSubmissionId, // Masked for privacy
            chatId: maskedChatId, // Masked for privacy
            revision: submission.data.revision,
            source: submission.data.source,
          },
        };

        patches.push({
          identifier,
          content: Buffer.from(chatBlob, 'utf8'),
          metadata,
        });
      }
    }

    this.logger.log(
      `Extracted ${patches.length} chat patches from ${downloadResult.submissions.length} submissions`,
    );

    // Write patches list to file for inspection
    await this.writePatchesToFile(patches, downloadResult.userId);

    return patches;
  }

  /**
   * Publish a quilt to Walrus publisher
   */
  async publishQuilt(
    patches: QuiltPatch[],
    epochs: number = 1,
  ): Promise<QuiltPublishResult> {
    try {
      const submissionConfig = this.configService.getOrThrow<SubmissionConfig>(
        'submission',
        { infer: true },
      );

      if (patches.length === 0) {
        throw new Error('Cannot publish empty quilt');
      }

      // Validate patch count (Walrus supports up to 666 patches per quilt)
      if (patches.length > 666) {
        throw new Error(
          `Too many patches: ${patches.length}. Walrus supports maximum 666 patches per quilt.`,
        );
      }

      this.logger.log(
        `Publishing quilt with ${patches.length} patches to ${submissionConfig.walrusPublisherUrl}`,
      );

      // Create form data
      const formData = new FormData();

      // Add each patch as a form field with identifier as field name
      for (const patch of patches) {
        formData.append(patch.identifier, patch.content, {
          filename: `${patch.identifier}.json`,
          contentType: 'application/json',
        });
      }

      // Add metadata field (must be named _metadata)
      const metadataArray = patches.map((patch) => ({
        identifier: patch.identifier,
        tags: patch.metadata.tags,
      }));
      formData.append('_metadata', JSON.stringify(metadataArray));

      // Write request to file for inspection (before sending)
      await this.writeRequestToFile(
        formData,
        patches,
        metadataArray,
        submissionConfig.walrusPublisherUrl,
        epochs,
      );

      // Send HTTP request to Walrus publisher
      const url = `${submissionConfig.walrusPublisherUrl}/v1/quilts?epochs=${epochs}`;
      const headers = formData.getHeaders();

      this.logger.debug(`Sending PUT request to ${url}`);

      const response = await this.httpService.axiosRef.put(url, formData, {
        headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000, // 5 minutes timeout for large quilts
      });

      this.logger.log(
        `Successfully published quilt. Response status: ${response.status}`,
      );

      // Parse response
      const responseData = response.data;
      
      // Extract on-chain blob object ID from newlyCreated
      const onChainBlobObjectId =
        responseData.blobStoreResult?.newlyCreated?.blobObject?.id;

      // Extract quilt blob ID from newlyCreated
      const quiltBlobId =
        responseData.blobStoreResult?.newlyCreated?.blobObject?.blobId;

      // Handle alreadyCertified case (if quilt was already stored)
      const alreadyCertifiedBlobId =
        responseData.blobStoreResult?.alreadyCertified?.blobId;

      if (!quiltBlobId && !alreadyCertifiedBlobId) {
        throw new Error(
          'Invalid response from Walrus publisher: missing quilt blob ID',
        );
      }

      // Use alreadyCertified blobId if newlyCreated is not available
      const finalQuiltBlobId = quiltBlobId || alreadyCertifiedBlobId;
      // For alreadyCertified, we don't have the on-chain ID, so use blobId as fallback
      const finalOnChainId = onChainBlobObjectId || finalQuiltBlobId;

      // Map stored quilt blobs to our result format
      const storedBlobs = responseData.storedQuiltBlobs || [];
      const result: QuiltPublishResult = {
        quiltId: finalOnChainId, // On-chain blob object ID (or blobId if alreadyCertified)
        quiltBlobId: finalQuiltBlobId, // Quilt blob ID
        patches: storedBlobs.map((storedBlob: any) => {
          // Find the original patch to get userId, submissionId, chatId
          const originalPatch = patches.find(
            (p) => p.identifier === storedBlob.identifier,
          );

          return {
            identifier: storedBlob.identifier,
            quiltPatchId: storedBlob.quiltPatchId,
            userId: originalPatch?.metadata.tags.userId || '',
            submissionId: originalPatch?.metadata.tags.submissionId || '',
            chatId: originalPatch?.metadata.tags.chatId || '',
          };
        }),
        totalPatches: storedBlobs.length,
        publishedAt: new Date(),
      };

      this.logger.log(
        `Quilt published successfully. On-chain ID: ${result.quiltId}, Blob ID: ${result.quiltBlobId}, Patches: ${result.totalPatches}`,
      );

      return result;
    } catch (error) {
      this.logger.error('Failed to publish quilt to Walrus:', error);

      // If it's an HTTP error, log more details
      if (error.response) {
        this.logger.error(
          `HTTP error response: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
        );
      }

      throw error;
    }
  }

  /**
   * Process batch download result: extract chats and publish as quilt
   */
  async processAndPublishQuilt(
    downloadResult: BatchDownloadResult,
    epochs: number = 1,
  ): Promise<QuiltPublishResult> {
    try {
      // Extract chats to patches
      const patches = await this.extractChatsToPatches(downloadResult);

      if (patches.length === 0) {
        throw new Error('No chats found in downloaded submissions');
      }

      // Publish quilt
      const result = await this.publishQuilt(patches, epochs);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process and publish quilt for user ${this.idMasker.maskUserId(downloadResult.userId)}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Write patches list to file for inspection
   */
  private async writePatchesToFile(
    patches: QuiltPatch[],
    userId: string,
  ): Promise<void> {
    try {
      const outputDir = join(process.cwd(), 'temp', 'walrus-quilts');
      await fs.mkdir(outputDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const maskedUserId = this.idMasker.maskUserId(userId);
      const filename = `quilt-patches-${maskedUserId}-${timestamp}.json`;
      const filePath = join(outputDir, filename);

      // Mask IDs in the output file for privacy (but keep real IDs in Walrus metadata)
      const patchesData = patches.map((patch) => ({
        identifier: patch.identifier, // Keep identifier as-is for reference
        contentSize: patch.content.length,
        contentPreview: patch.content.toString('utf8').substring(0, 200),
        metadata: {
          ...patch.metadata,
          tags: {
            ...patch.metadata.tags,
            // Mask IDs in file output for privacy
            userId: this.idMasker.maskUserId(patch.metadata.tags.userId),
            submissionId: this.idMasker.maskSubmissionId(
              patch.metadata.tags.submissionId,
            ),
            chatId: this.idMasker.maskChatId(patch.metadata.tags.chatId),
          },
        },
      }));

      const output = {
        userId: maskedUserId, // Mask user ID in file output
        totalPatches: patches.length,
        extractedAt: new Date().toISOString(),
        patches: patchesData,
      };

      await fs.writeFile(filePath, JSON.stringify(output, null, 2), 'utf8');

      this.logger.log(`Quilt patches list written to file: ${filePath}`);
    } catch (error) {
      this.logger.warn(
        `Failed to write patches list to file: ${error.message}`,
      );
    }
  }

  /**
   * Write request data to file for inspection
   */
  private async writeRequestToFile(
    formData: FormData,
    patches: QuiltPatch[],
    metadataArray: Array<{ identifier: string; tags: Record<string, string> }>,
    publisherUrl: string,
    epochs: number,
  ): Promise<void> {
    try {
      const outputDir = join(process.cwd(), 'temp', 'walrus-quilts');
      await fs.mkdir(outputDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `quilt-request-${timestamp}.json`;
      const filePath = join(outputDir, filename);

      // Extract form data information
      // Mask IDs in file output for privacy (but keep real IDs in actual Walrus request)
      const requestData = {
        url: `${publisherUrl}/v1/quilts?epochs=${epochs}`,
        method: 'PUT',
        epochs,
        totalPatches: patches.length,
        headers: formData.getHeaders(),
        metadata: metadataArray.map((meta) => ({
          identifier: meta.identifier,
          tags: {
            ...meta.tags,
            // Mask IDs in file output for privacy
            userId: this.idMasker.maskUserId(meta.tags.userId),
            submissionId: this.idMasker.maskSubmissionId(meta.tags.submissionId),
            chatId: this.idMasker.maskChatId(meta.tags.chatId),
          },
        })),
        patches: patches.map((patch) => ({
          identifier: patch.identifier,
          contentSize: patch.content.length,
          contentPreview: patch.content.toString('utf8').substring(0, 500),
          metadata: {
            ...patch.metadata,
            tags: {
              ...patch.metadata.tags,
              // Mask IDs in file output for privacy
              userId: this.idMasker.maskUserId(patch.metadata.tags.userId),
              submissionId: this.idMasker.maskSubmissionId(
                patch.metadata.tags.submissionId,
              ),
              chatId: this.idMasker.maskChatId(patch.metadata.tags.chatId),
            },
          },
        })),
        requestInfo: {
          contentType: formData.getHeaders()['content-type'],
          totalSize: patches.reduce(
            (sum, patch) => sum + patch.content.length,
            0,
          ),
          createdAt: new Date().toISOString(),
        },
      };

      await fs.writeFile(
        filePath,
        JSON.stringify(requestData, null, 2),
        'utf8',
      );

      this.logger.log(`Quilt request data written to file: ${filePath}`);
    } catch (error) {
      this.logger.warn(
        `Failed to write request data to file: ${error.message}`,
      );
    }
  }
}

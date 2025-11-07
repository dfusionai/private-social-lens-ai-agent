import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import FormData from 'form-data';
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
  extractChatsToPatches(downloadResult: BatchDownloadResult): QuiltPatch[] {
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
        const maskedChatId = this.idMasker.reversiblyMaskChatId(chat.chat_id);

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
      const patches = this.extractChatsToPatches(downloadResult);

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
}

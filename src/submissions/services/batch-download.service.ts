import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { SubmissionRepository } from '../infrastructure/persistence/submission.repository';
import { UserBatchTrackingRepository } from '../infrastructure/persistence/user-batch-tracking.repository';
import { AzureBlobStorageService } from './azure-blob-storage.service';
import { WalrusQuiltService } from './walrus-quilt.service';
import {
  DownloadedSubmission,
  BatchDownloadResult,
} from '../domain/downloaded-submission';
import { SubmissionData } from '../domain/submission';
import { ConfigService } from '@nestjs/config';
import { SubmissionConfig } from '../config/submission-config.type';
import { AllConfigType } from '../../config/config.type';
import { IdMaskerService } from '../../utils/id-masker.service';

@Injectable()
export class BatchDownloadService {
  private readonly logger = new Logger(BatchDownloadService.name);

  constructor(
    private readonly submissionRepository: SubmissionRepository,
    private readonly userBatchTrackingRepository: UserBatchTrackingRepository,
    private readonly azureBlobStorage: AzureBlobStorageService,
    private readonly walrusQuiltService: WalrusQuiltService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly idMasker: IdMaskerService,
  ) {}

  async processBatchDownload(
    userId: string,
    batchTrackingId: string,
  ): Promise<BatchDownloadResult> {
    try {
      this.logger.log(
        `Starting batch download for user ${this.idMasker.maskUserId(userId)}, batch tracking ${this.idMasker.maskBatchTrackingId(batchTrackingId)}`,
      );

      // 1. Get all submissions for this user
      const submissions = await this.submissionRepository.findByUserId(userId);

      if (submissions.length === 0) {
        this.logger.warn(
          `No submissions found for user ${this.idMasker.maskUserId(userId)}`,
        );
        await this.resetBatchTracking(userId);
        return {
          userId: userId.toString(),
          batchTrackingId,
          submissions: [],
          totalChats: 0,
          downloadedAt: new Date(),
        };
      }

      this.logger.log(
        `Found ${submissions.length} submissions for user ${this.idMasker.maskUserId(userId)}. Starting blob downloads...`,
      );

      // 2. Download all blobs from Azure Blob Storage
      const downloadedSubmissions: DownloadedSubmission[] = [];
      let totalChats = 0;

      for (const submission of submissions) {
        try {
          this.logger.debug(
            `Downloading blob ${submission.blobName} for submission ${this.idMasker.maskSubmissionId(submission.id)}`,
          );

          // Download blob from Azure
          const blobData = await this.azureBlobStorage.downloadBlob(
            submission.blobName,
          );

          // Parse JSON data
          const submissionData: SubmissionData = JSON.parse(
            blobData.toString('utf8'),
          );

          // Validate that we got the expected data structure
          if (!submissionData.chats || !Array.isArray(submissionData.chats)) {
            throw new Error(
              `Invalid submission data: missing or invalid chats array for submission ${this.idMasker.maskSubmissionId(submission.id)}`,
            );
          }

          downloadedSubmissions.push({
            submissionId: submission.id,
            blobName: submission.blobName,
            blobUrl: submission.blobUrl,
            data: submissionData,
            chatCount: submission.chatCount,
          });

          totalChats += submission.chatCount;

          this.logger.debug(
            `Successfully downloaded submission ${this.idMasker.maskSubmissionId(submission.id)} with ${submission.chatCount} chats`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to download blob for submission ${this.idMasker.maskSubmissionId(submission.id)} (${submission.blobName}):`,
            error,
          );
          // Continue with other submissions even if one fails
          // We'll log the error but not fail the entire batch
        }
      }

      if (downloadedSubmissions.length === 0) {
        throw new Error(
          `Failed to download any submissions for user ${this.idMasker.maskUserId(userId)}. All ${submissions.length} downloads failed.`,
        );
      }

      const result: BatchDownloadResult = {
        userId: userId.toString(),
        batchTrackingId,
        submissions: downloadedSubmissions,
        totalChats,
        downloadedAt: new Date(),
      };

      this.logger.log(
        `Successfully downloaded ${downloadedSubmissions.length}/${submissions.length} submissions for user ${this.idMasker.maskUserId(userId)}. Total chats: ${totalChats}`,
      );

      // Write result to local file for inspection
      await this.writeResultToFile(result);

      // Process quilt (extract patches and write files for inspection)
      // This will always run to generate inspection files, even if URL is not configured
      const submissionConfig = this.configService.get<SubmissionConfig>(
        'submission',
        { infer: true },
      );

      try {
        // Process quilt: extract patches, write files for inspection, and publish to Walrus
        const blobStoreResult =
          await this.walrusQuiltService.processAndPublishQuilt(
            result,
            submissionConfig.walrusQuiltEpochs || 1,
          );

        this.logger.log(
          `Blob store result: ${JSON.stringify(blobStoreResult)}`,
        );

        // If we get here, quilt was processed and published successfully
        // Clean up: mark submissions as deleted and remove Azure blobs
        await this.cleanupProcessedSubmissions(downloadedSubmissions);

        // Reset batch tracking after successful quilt processing
        await this.resetBatchTracking(userId);
      } catch (error) {
        // Real error - don't reset batch tracking to allow retry
        this.logger.error(
          `Failed to process quilt for user ${this.idMasker.maskUserId(userId)}:`,
          error,
        );
        throw error;
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process batch download for user ${this.idMasker.maskUserId(userId)}:`,
        error,
      );

      // Reset batch status to pending on error so it can be retried
      const batchTracking =
        await this.userBatchTrackingRepository.findByUserId(userId);
      if (batchTracking) {
        await this.userBatchTrackingRepository.update(batchTracking.id, {
          batchStatus: 'pending',
        });
      }

      throw error;
    }
  }

  async resetBatchTracking(userId: string): Promise<void> {
    const batchTracking =
      await this.userBatchTrackingRepository.findByUserId(userId);

    if (batchTracking) {
      await this.userBatchTrackingRepository.update(batchTracking.id, {
        chatCount: 0,
        batchStatus: 'pending',
      });
      this.logger.log(
        `Reset batch tracking for user ${this.idMasker.maskUserId(userId)}`,
      );
    }
  }

  /**
   * Clean up processed submissions after successful quilt upload:
   * 1. Mark submissions as deleted (soft delete) in database
   * 2. Delete blobs from Azure Blob Storage
   */
  private async cleanupProcessedSubmissions(
    downloadedSubmissions: DownloadedSubmission[],
  ): Promise<void> {
    this.logger.log(
      `Starting cleanup for ${downloadedSubmissions.length} processed submissions`,
    );

    const cleanupErrors: Array<{ submissionId: string; error: string }> = [];

    // Process each submission cleanup
    for (const submission of downloadedSubmissions) {
      try {
        // 1. Mark submission as deleted (soft delete) in database
        await this.submissionRepository.remove(submission.submissionId);
        this.logger.debug(
          `Marked submission ${this.idMasker.maskSubmissionId(submission.submissionId)} as deleted`,
        );

        // 2. Delete blob from Azure Blob Storage
        await this.azureBlobStorage.deleteBlob(submission.blobName);
        this.logger.debug(
          `Deleted Azure blob ${submission.blobName} for submission ${this.idMasker.maskSubmissionId(submission.submissionId)}`,
        );
      } catch (error) {
        // Log error but continue with other submissions
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        cleanupErrors.push({
          submissionId: submission.submissionId,
          error: errorMessage,
        });
        this.logger.error(
          `Failed to cleanup submission ${this.idMasker.maskSubmissionId(submission.submissionId)} (blob: ${submission.blobName}):`,
          error,
        );
      }
    }

    // Log summary
    const successCount = downloadedSubmissions.length - cleanupErrors.length;
    this.logger.log(
      `Cleanup completed: ${successCount}/${downloadedSubmissions.length} submissions cleaned up successfully`,
    );

    if (cleanupErrors.length > 0) {
      this.logger.warn(
        `Cleanup errors for ${cleanupErrors.length} submissions. These submissions may be reprocessed in the next batch.`,
        cleanupErrors.map((e) => ({
          submissionId: this.idMasker.maskSubmissionId(e.submissionId),
          error: e.error,
        })),
      );
    }
  }

  private async writeResultToFile(result: BatchDownloadResult): Promise<void> {
    try {
      // Create output directory if it doesn't exist
      const outputDir = join(process.cwd(), 'temp', 'batch-downloads');
      await fs.mkdir(outputDir, { recursive: true });

      // Create filename with timestamp and masked user ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const maskedUserId = this.idMasker.maskUserId(result.userId);
      const filename = `batch-download-${maskedUserId}-${timestamp}.json`;
      const filePath = join(outputDir, filename);

      // Convert Date objects to ISO strings for JSON serialization
      // Mask IDs in the output for privacy
      const serializableResult = {
        ...result,
        userId: maskedUserId, // Mask user ID in file output
        downloadedAt: result.downloadedAt.toISOString(),
        submissions: result.submissions.map((submission) => ({
          ...submission,
          submissionId: this.idMasker.maskSubmissionId(submission.submissionId), // Mask submission ID
          data: {
            ...submission.data,
            user: this.idMasker.maskUserId(submission.data.user), // Mask user ID in data
            chats: submission.data.chats.map((chat) => ({
              ...chat,
              chat_id: this.idMasker.maskChatId(chat.chat_id), // Mask chat ID
            })),
          },
        })),
      };

      // Write to file with pretty formatting
      await fs.writeFile(
        filePath,
        JSON.stringify(serializableResult, null, 2),
        'utf8',
      );

      this.logger.log(`Batch download result written to file: ${filePath}`);
    } catch (error) {
      // Don't fail the batch download if file writing fails
      this.logger.warn(
        `Failed to write batch download result to file: ${error.message}`,
      );
    }
  }
}

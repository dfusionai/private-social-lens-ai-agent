import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { SubmissionRepository } from '../infrastructure/persistence/submission.repository';
import { UserBatchTrackingRepository } from '../infrastructure/persistence/user-batch-tracking.repository';
import { AzureBlobStorageService } from './azure-blob-storage.service';
import {
  DownloadedSubmission,
  BatchDownloadResult,
} from '../domain/downloaded-submission';
import { SubmissionData } from '../domain/submission';

@Injectable()
export class BatchDownloadService {
  private readonly logger = new Logger(BatchDownloadService.name);

  constructor(
    private readonly submissionRepository: SubmissionRepository,
    private readonly userBatchTrackingRepository: UserBatchTrackingRepository,
    private readonly azureBlobStorage: AzureBlobStorageService,
  ) {}

  async processBatchDownload(
    userId: string,
    batchTrackingId: string,
  ): Promise<BatchDownloadResult> {
    try {
      this.logger.log(
        `Starting batch download for user ${userId}, batch tracking ${batchTrackingId}`,
      );

      // 1. Get all submissions for this user
      const submissions = await this.submissionRepository.findByUserId(userId);

      if (submissions.length === 0) {
        this.logger.warn(`No submissions found for user ${userId}`);
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
        `Found ${submissions.length} submissions for user ${userId}. Starting blob downloads...`,
      );

      // 2. Download all blobs from Azure Blob Storage
      const downloadedSubmissions: DownloadedSubmission[] = [];
      let totalChats = 0;

      for (const submission of submissions) {
        try {
          this.logger.debug(
            `Downloading blob ${submission.blobName} for submission ${submission.id}`,
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
              `Invalid submission data: missing or invalid chats array for submission ${submission.id}`,
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
            `Successfully downloaded submission ${submission.id} with ${submission.chatCount} chats`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to download blob for submission ${submission.id} (${submission.blobName}):`,
            error,
          );
          // Continue with other submissions even if one fails
          // We'll log the error but not fail the entire batch
        }
      }

      if (downloadedSubmissions.length === 0) {
        throw new Error(
          `Failed to download any submissions for user ${userId}. All ${submissions.length} downloads failed.`,
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
        `Successfully downloaded ${downloadedSubmissions.length}/${submissions.length} submissions for user ${userId}. Total chats: ${totalChats}`,
      );

      // Write result to local file for inspection
      await this.writeResultToFile(result);

      // Note: We don't reset batch tracking here yet
      // That will happen after the blobs are processed for Walrus (Part 2)
      // For now, we just return the downloaded data

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process batch download for user ${userId}:`,
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
      this.logger.log(`Reset batch tracking for user ${userId}`);
    }
  }

  private async writeResultToFile(result: BatchDownloadResult): Promise<void> {
    try {
      // Create output directory if it doesn't exist
      const outputDir = join(process.cwd(), 'temp', 'batch-downloads');
      await fs.mkdir(outputDir, { recursive: true });

      // Create filename with timestamp and user ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `batch-download-${result.userId}-${timestamp}.json`;
      const filePath = join(outputDir, filename);

      // Convert Date objects to ISO strings for JSON serialization
      const serializableResult = {
        ...result,
        downloadedAt: result.downloadedAt.toISOString(),
        submissions: result.submissions.map((submission) => ({
          ...submission,
          data: submission.data,
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

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SubmissionRepository } from '../infrastructure/persistence/submission.repository';
import { UserBatchTrackingRepository } from '../infrastructure/persistence/user-batch-tracking.repository';
import { AzureBlobStorageService } from './azure-blob-storage.service';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../config/config.type';

@Injectable()
export class BatchDownloadService {
  private readonly logger = new Logger(BatchDownloadService.name);

  constructor(
    private readonly submissionRepository: SubmissionRepository,
    private readonly userBatchTrackingRepository: UserBatchTrackingRepository,
    private readonly azureBlobStorage: AzureBlobStorageService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async processBatchDownload(
    userId: number | string,
    batchTrackingId: string,
    downloadServiceUrl: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Starting batch download for user ${userId}, batch tracking ${batchTrackingId}`,
      );

      // 1. Get all submissions for this user
      const submissions = await this.submissionRepository.findByUserId(userId);

      if (submissions.length === 0) {
        this.logger.warn(`No submissions found for user ${userId}`);
        await this.resetBatchTracking(userId);
        return;
      }

      // 2. Prepare blob URLs for download service
      const blobUrls = submissions.map((submission) => ({
        blobUrl: submission.blobUrl,
        blobName: submission.blobName,
        submissionId: submission.id,
        chatCount: submission.chatCount,
      }));

      // 3. Send request to download service
      const response = await firstValueFrom(
        this.httpService.post(downloadServiceUrl, {
          userId: userId.toString(),
          batchTrackingId,
          blobUrls,
        }),
      );

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(
          `Download service returned status ${response.status}: ${response.statusText}`,
        );
      }

      this.logger.log(
        `Successfully triggered batch download for user ${userId}. Service response: ${response.status}`,
      );

      // 4. Reset batch tracking after successful download trigger
      await this.resetBatchTracking(userId);

      this.logger.log(`Batch download process completed for user ${userId}`);
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

  private async resetBatchTracking(userId: number | string): Promise<void> {
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
}

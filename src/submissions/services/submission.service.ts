import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubmissionRepository } from '../infrastructure/persistence/submission.repository';
import { UserBatchTrackingRepository } from '../infrastructure/persistence/user-batch-tracking.repository';
import { AzureBlobStorageService } from './azure-blob-storage.service';
import { CreateSubmissionDto } from '../dto/create-submission.dto';
import { Submission } from '../domain/submission';
import { UserBatchTracking } from '../domain/user-batch-tracking';
import { SubmissionConfig } from '../config/submission-config.type';
import { AllConfigType } from '../../config/config.type';
import { PgBossQueueService } from '../../jobs/services/pg-boss-queue.service';
import { JobType } from '../../jobs/enums/job-type.enum';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);

  constructor(
    private readonly submissionRepository: SubmissionRepository,
    private readonly userBatchTrackingRepository: UserBatchTrackingRepository,
    private readonly azureBlobStorage: AzureBlobStorageService,
    private readonly pgBossQueue: PgBossQueueService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async createSubmission(
    createSubmissionDto: CreateSubmissionDto,
  ): Promise<{ submissionId: string; chatCount: number }> {
    try {
      // 1. Use the user string from the submission data
      const userId = createSubmissionDto.user;

      // 2. Calculate total chat count for this submission
      const submissionChatCount = createSubmissionDto.chats.length;

      // 3. Get or create user batch tracking
      let batchTracking =
        await this.userBatchTrackingRepository.findByUserId(userId);

      if (!batchTracking) {
        batchTracking = await this.userBatchTrackingRepository.create(
          new UserBatchTracking({
            userId: userId,
            chatCount: 0,
            batchStatus: 'pending',
          }),
        );
      }

      // 4. Check if batch is already processing
      if (batchTracking.batchStatus === 'processing') {
        throw new BadRequestException(
          'Batch is currently being processed. Please wait for completion.',
        );
      }

      // 4. Store submission as blob in Azure Blob Storage
      const blobName = `submissions/${userId}/${uuidv4()}.json`;
      const submissionData = {
        revision: createSubmissionDto.revision,
        source: createSubmissionDto.source,
        user: createSubmissionDto.user,
        submission_token: createSubmissionDto.submission_token,
        chats: createSubmissionDto.chats,
      };

      // Log to verify data is preserved
      if (submissionData.chats && submissionData.chats.length > 0) {
        const firstChat = submissionData.chats[0];
        this.logger.debug(
          `Storing submission with ${submissionData.chats.length} chats. First chat has ${firstChat.contents?.length || 0} messages`,
        );
        if (firstChat.contents && firstChat.contents.length > 0) {
          const firstMessage = firstChat.contents[0];
          const messageKeys = Object.keys(firstMessage || {});
          this.logger.debug(
            `First message has ${messageKeys.length} properties: ${messageKeys.slice(0, 5).join(', ')}${messageKeys.length > 5 ? '...' : ''}`,
          );
        }
      }

      // Use JSON.stringify with a replacer to handle Buffer objects and other edge cases
      const serializedData = JSON.stringify(submissionData, (key, value) => {
        // Handle Buffer objects (convert to {type: 'Buffer', data: [...]})
        if (
          value &&
          typeof value === 'object' &&
          value.type === 'Buffer' &&
          Array.isArray(value.data)
        ) {
          return value; // Already in Buffer format, keep as is
        }
        // Handle all other values normally
        return value;
      });

      const blobUrl = await this.azureBlobStorage.uploadBlob(
        blobName,
        serializedData,
        'application/json',
      );

      // 5. Save submission record (without submissionData - data is stored in blob)
      const submission = await this.submissionRepository.create(
        new Submission({
          userId: userId,
          blobUrl,
          blobName,
          chatCount: submissionChatCount,
        }),
      );

      // 6. Update user batch tracking
      const newChatCount = batchTracking.chatCount + submissionChatCount;
      const updatedBatchTracking =
        await this.userBatchTrackingRepository.update(batchTracking.id, {
          chatCount: newChatCount,
        });

      this.logger.log(
        `Created submission ${submission.id} for user ${userId}. Total chats: ${newChatCount}`,
      );

      // 7. Check if threshold reached and trigger batch processing
      const submissionConfig = this.configService.get<SubmissionConfig>(
        'submission',
        { infer: true },
      );

      if (
        updatedBatchTracking &&
        newChatCount >= submissionConfig.batchChatThreshold &&
        newChatCount <= submissionConfig.batchChatMaxThreshold
      ) {
        await this.triggerBatchProcessing(userId, updatedBatchTracking);
      }

      return {
        submissionId: submission.id,
        chatCount: newChatCount,
      };
    } catch (error) {
      this.logger.error('Failed to create submission:', error);
      throw error;
    }
  }

  private async triggerBatchProcessing(
    userId: string,
    batchTracking: UserBatchTracking,
  ): Promise<void> {
    try {
      // Update batch status to processing
      await this.userBatchTrackingRepository.update(batchTracking.id, {
        batchStatus: 'processing',
      });

      // Queue a job to download blobs from Azure and process them
      await this.pgBossQueue.addJob(userId, {
        customJobId: uuidv4(),
        jobType: JobType.BATCH_DOWNLOAD,
        blobId: '', // Not used for batch jobs
        onchainFileId: '', // Not used for batch jobs
        policyId: '', // Not used for batch jobs
        priority: 5,
        metadata: {
          userId: userId.toString(),
          batchTrackingId: batchTracking.id,
          chatCount: batchTracking.chatCount,
        },
      });

      this.logger.log(
        `Triggered batch processing for user ${userId} with ${batchTracking.chatCount} chats`,
      );
    } catch (error) {
      this.logger.error('Failed to trigger batch processing:', error);
      // Reset batch status on error
      await this.userBatchTrackingRepository.update(batchTracking.id, {
        batchStatus: 'pending',
      });
      throw error;
    }
  }

  async getUserSubmissions(userId: string): Promise<Submission[]> {
    return await this.submissionRepository.findByUserId(userId);
  }

  async getBatchTracking(userId: string): Promise<UserBatchTracking | null> {
    return await this.userBatchTrackingRepository.findByUserId(userId);
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
}

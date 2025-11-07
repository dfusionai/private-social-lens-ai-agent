import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubmissionRepository } from '../infrastructure/persistence/submission.repository';
import { BatchRepository } from '../infrastructure/persistence/batch.repository';
import { AzureBlobStorageService } from './azure-blob-storage.service';
import { CreateSubmissionDto } from '../dto/create-submission.dto';
import { Submission } from '../domain/submission';
import { Batch } from '../domain/batch';
import { SubmissionConfig } from '../config/submission-config.type';
import { AllConfigType } from '../../config/config.type';
import { PgBossQueueService } from '../../jobs/services/pg-boss-queue.service';
import { JobType } from '../../jobs/enums/job-type.enum';
import { IdMaskerService } from '../../utils/id-masker.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);

  constructor(
    private readonly submissionRepository: SubmissionRepository,
    private readonly batchRepository: BatchRepository,
    private readonly azureBlobStorage: AzureBlobStorageService,
    private readonly pgBossQueue: PgBossQueueService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly idMasker: IdMaskerService,
  ) {}

  async createSubmission(
    createSubmissionDto: CreateSubmissionDto,
    userId: string,
  ): Promise<{ submissionId: string; chatCount: number }> {
    try {
      // 1. Use the userId from authenticated user (telegram ID)

      // 2. Calculate total chat count for this submission
      const submissionChatCount = createSubmissionDto.chats.length;

      // 3. Get or create batch for this submission
      const batch = await this.findOrCreateBatch(userId, submissionChatCount);

      // 4. Check if batch is already processing
      if (batch.batchStatus === 'processing') {
        throw new BadRequestException(
          'Batch is currently being processed. Please wait for completion.',
        );
      }

      // 4. Store submission as blob in Azure Blob Storage
      const blobName = `submissions/${userId}/${uuidv4()}.json`;
      const submissionData = {
        revision: createSubmissionDto.revision,
        source: createSubmissionDto.source,
        user: userId, // Use authenticated user's socialId (telegram ID)
        submission_token: createSubmissionDto.submission_token,
        walletAddress: createSubmissionDto.walletAddress,
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
          batchId: batch.id,
        }),
      );

      // 6. Update batch chat count
      const newChatCount = batch.chatCount + submissionChatCount;
      const updatedBatch = await this.batchRepository.update(batch.id, {
        chatCount: newChatCount,
      });

      this.logger.log(
        `Created submission ${this.idMasker.maskSubmissionId(submission.id)} for user ${this.idMasker.maskUserId(userId)} in batch ${batch.batchNumber}. Batch chats: ${newChatCount}`,
      );

      // 7. Check if threshold reached and trigger batch processing
      const submissionConfig = this.configService.get<SubmissionConfig>(
        'submission',
        { infer: true },
      );

      if (
        updatedBatch &&
        newChatCount >= submissionConfig.batchChatThreshold &&
        newChatCount <= submissionConfig.batchChatMaxThreshold
      ) {
        await this.triggerBatchProcessing(userId, updatedBatch.id);
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

  /**
   * Find or create a batch for a submission.
   * Creates a new batch if:
   * - No batch exists for the user
   * - Latest batch is 'failed'
   * - Latest batch is 'processing' (can't add to it)
   * - Adding to latest batch would exceed max threshold
   */
  private async findOrCreateBatch(
    userId: string,
    submissionChatCount: number,
  ): Promise<Batch> {
    const submissionConfig = this.configService.get<SubmissionConfig>(
      'submission',
      { infer: true },
    );

    // Find latest batch for user
    const latestBatch = await this.batchRepository.findLatestByUserId(userId);

    // Determine if we need a new batch
    const needsNewBatch =
      !latestBatch ||
      latestBatch.batchStatus === 'failed' ||
      latestBatch.batchStatus === 'processing' ||
      latestBatch.chatCount + submissionChatCount >
        submissionConfig.batchChatMaxThreshold;

    if (needsNewBatch) {
      // Create new batch with chatCount: 0
      // The chat count will be added when we update the batch after creating the submission
      const batchNumber = latestBatch ? latestBatch.batchNumber + 1 : 1;
      const newBatch = await this.batchRepository.create(
        new Batch({
          userId: userId,
          batchNumber: batchNumber,
          chatCount: 0, // Start with 0, will be updated after submission is created
          batchStatus: 'pending',
          retryCount: 0,
          maxRetries: 3,
        }),
      );

      this.logger.log(
        `Created new batch ${batchNumber} for user ${this.idMasker.maskUserId(userId)}`,
      );

      return newBatch;
    }

    // Use existing batch
    return latestBatch;
  }

  private async triggerBatchProcessing(
    userId: string,
    batchId: string,
  ): Promise<void> {
    try {
      // Update batch status to processing
      await this.batchRepository.update(batchId, {
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
          batchId: batchId,
        },
      });

      const batch = await this.batchRepository.findById(batchId);
      this.logger.log(
        `Triggered batch processing for user ${this.idMasker.maskUserId(userId)}, batch ${batch?.batchNumber} with ${batch?.chatCount} chats`,
      );
    } catch (error) {
      this.logger.error('Failed to trigger batch processing:', error);
      // Reset batch status on error
      await this.batchRepository.update(batchId, {
        batchStatus: 'pending',
      });
      throw error;
    }
  }

  async getUserSubmissions(userId: string): Promise<Submission[]> {
    return await this.submissionRepository.findByUserId(userId);
  }

  async getUserBatches(userId: string): Promise<Batch[]> {
    return await this.batchRepository.findByUserId(userId);
  }
}

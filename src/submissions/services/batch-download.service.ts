import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { SubmissionRepository } from '../infrastructure/persistence/submission.repository';
import { BatchRepository } from '../infrastructure/persistence/batch.repository';
import { AzureBlobStorageService } from './azure-blob-storage.service';
import { WalrusQuiltService } from './walrus-quilt.service';
import { VanaBlockchainService } from './vana-blockchain.service';
import { SealService } from './seal.service';
import { SuiBlockchainService } from './sui-blockchain.service';
import {
  DownloadedSubmission,
  BatchDownloadResult,
} from '../domain/downloaded-submission';
import { SubmissionData } from '../domain/submission';
import { ConfigService } from '@nestjs/config';
import { SubmissionConfig } from '../config/submission-config.type';
import { AllConfigType } from '../../config/config.type';
import { IdMaskerService } from '../../utils/id-masker.service';
import { JobProducerService } from '../../jobs/services/job-producer.service';
import { JobType } from '../../jobs/enums/job-type.enum';
import { UsersService } from '../../users/users.service';
import { AuthProvidersEnum } from '../../auth/auth-providers.enum';
import { tokenGatingConfigsService } from '../../token-gating-configs/token-gating-configs.service';

@Injectable()
export class BatchDownloadService {
  private readonly logger = new Logger(BatchDownloadService.name);

  constructor(
    private readonly submissionRepository: SubmissionRepository,
    private readonly batchRepository: BatchRepository,
    private readonly azureBlobStorage: AzureBlobStorageService,
    private readonly walrusQuiltService: WalrusQuiltService,
    private readonly blockchainService: VanaBlockchainService,
    private readonly tokenGatingConfigsService: tokenGatingConfigsService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly idMasker: IdMaskerService,
    @Inject(forwardRef(() => JobProducerService))
    private readonly jobProducerService: JobProducerService,
    private readonly usersService: UsersService,
    private readonly sealService: SealService,
    private readonly suiBlockchainService: SuiBlockchainService,
  ) {}

  async processBatchDownload(
    userId: string,
    batchId: string,
  ): Promise<BatchDownloadResult> {
    try {
      this.logger.log(
        `Starting batch download for user ${this.idMasker.maskUserId(userId)}, batch ${batchId}`,
      );

      // 1. Get batch to verify it exists
      const batch = await this.batchRepository.findById(batchId);
      if (!batch) {
        throw new Error(`Batch ${batchId} not found`);
      }

      // 1.5. Check if batch is already failed - don't process failed batches
      if (batch.batchStatus === 'failed') {
        this.logger.warn(
          `Batch ${batchId} is already failed (retry ${batch.retryCount}/${batch.maxRetries}). Skipping processing.`,
        );
        throw new Error(
          `Batch ${batchId} is already failed and cannot be processed again`,
        );
      }

      // 2. Get all submissions for this specific batch
      const submissions =
        await this.submissionRepository.findByBatchId(batchId);

      if (submissions.length === 0) {
        this.logger.warn(
          `No submissions found for batch ${batchId} (user ${this.idMasker.maskUserId(userId)})`,
        );
        // Update batch status to completed (empty batch)
        await this.batchRepository.update(batchId, {
          batchStatus: 'completed',
        });
        return {
          userId: userId.toString(),
          batchTrackingId: batchId,
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

          // Parse encrypted submission data
          const encryptedSubmissionData = JSON.parse(blobData.toString('utf8'));

          // Validate encrypted data structure
          if (
            !encryptedSubmissionData.encryptedData ||
            !encryptedSubmissionData.encryptionId
          ) {
            throw new Error(
              `Invalid encrypted submission data: missing encryptedData or encryptionId for submission ${this.idMasker.maskSubmissionId(submission.id)}`,
            );
          }

          // Decrypt the submission data using Seal
          this.logger.debug(
            `Decrypting submission ${this.idMasker.maskSubmissionId(submission.id)}...`,
          );

          const submissionConfig = this.configService.get<SubmissionConfig>(
            'submission',
            { infer: true },
          );

          // Decrypt the encrypted data
          const decryptedDto = await this.sealService.decryptSubmission(
            encryptedSubmissionData.encryptedData,
            encryptedSubmissionData.encryptionId,
            submissionConfig.policyObjectId,
          );

          // Convert decrypted DTO to SubmissionData format
          // Use walletAddress from encrypted metadata (available before decryption)
          const submissionData: SubmissionData = {
            revision: decryptedDto.revision,
            source: decryptedDto.source,
            user: encryptedSubmissionData.userId || decryptedDto.user,
            submission_token: decryptedDto.submission_token,
            walletAddress: encryptedSubmissionData.walletAddress,
            chats: decryptedDto.chats,
          };

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
            `Successfully decrypted and downloaded submission ${this.idMasker.maskSubmissionId(submission.id)} with ${submission.chatCount} chats`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to download/decrypt blob for submission ${this.idMasker.maskSubmissionId(submission.id)} (${submission.blobName}):`,
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
        batchTrackingId: batchId,
        submissions: downloadedSubmissions,
        totalChats,
        downloadedAt: new Date(),
      };

      this.logger.log(
        `Successfully downloaded ${downloadedSubmissions.length}/${submissions.length} submissions for user ${this.idMasker.maskUserId(userId)}. Total chats: ${totalChats}`,
      );

      // Process quilt (extract patches and publish to Walrus)
      const submissionConfig = this.configService.get<SubmissionConfig>(
        'submission',
        { infer: true },
      );

      try {
        // Calculate epochs based on token gating
        // Extract wallet address from first submission (all submissions in a batch should have the same wallet address)
        let epochs = submissionConfig.walrusQuiltEpochs || 1;

        if (downloadedSubmissions.length > 0) {
          const firstSubmission = downloadedSubmissions[0];
          const walletAddress = firstSubmission.data.walletAddress;

          if (walletAddress) {
            try {
              // Get token gating config
              const tokenGatingConfig =
                await this.tokenGatingConfigsService.getLatestConfig();

              if (tokenGatingConfig) {
                const { stakeThreshold, balanceThreshold } = tokenGatingConfig;

                // Check if wallet meets token gating requirements
                const isAllowed = await this.blockchainService.checkTokenGating(
                  walletAddress,
                  stakeThreshold,
                  balanceThreshold,
                );

                // If not allowed, epochs = 1, else epochs = 53
                epochs = isAllowed ? 53 : 1;

                this.logger.log(
                  `Token gating check for wallet ${walletAddress}: allowed=${isAllowed}, epochs=${epochs}`,
                );
              } else {
                this.logger.warn(
                  'No token gating config found. Using default epochs.',
                );
              }
            } catch (error) {
              this.logger.error(
                `Failed to check token gating for wallet ${walletAddress}. Using default epochs:`,
                error,
              );
              // On error, default to epochs = 1
              epochs = 1;
            }
          } else {
            this.logger.warn(
              'No wallet address found in submission. Using default epochs.',
            );
          }
        }

        // Process quilt: extract patches, write files for inspection, and publish to Walrus
        const blobStoreResult =
          await this.walrusQuiltService.processAndPublishQuilt(result, epochs);

        this.logger.log(
          `Blob store result: ${JSON.stringify(blobStoreResult)}`,
        );

        // If we get here, quilt was processed and published successfully
        // Clean up: mark submissions as deleted and remove Azure blobs
        await this.cleanupProcessedSubmissions(downloadedSubmissions);

        // Update batch status to completed and store quilt info
        const updatedBatch = await this.batchRepository.update(batchId, {
          batchStatus: 'completed',
          quiltId: blobStoreResult?.quiltId,
          quiltBlobId: blobStoreResult?.quiltBlobId,
          epochs: epochs,
        });

        // Create Nautilus job to process the quilt
        // Only create job if the quilt has been saved on-chain successfully
        // (Now we save the quilt once, not individual patches)
        if (
          updatedBatch &&
          blobStoreResult?.quiltId &&
          blobStoreResult?.quiltBlobId &&
          blobStoreResult?.onChainFileObjId
        ) {
          this.logger.log(
            `Quilt saved on-chain (${blobStoreResult.onChainFileObjId}). Creating Nautilus job...`,
          );
          await this.createNautilusJob(
            userId,
            blobStoreResult.quiltId,
            blobStoreResult.quiltBlobId,
          );
        } else if (
          updatedBatch &&
          blobStoreResult?.quiltId &&
          blobStoreResult?.quiltBlobId
        ) {
          this.logger.warn(
            `Quilt not saved on-chain. Skipping Nautilus job creation.`,
          );
        }
      } catch (error) {
        // Real error - update batch retry count and status
        const batch = await this.batchRepository.findById(batchId);
        if (batch) {
          const newRetryCount = batch.retryCount + 1;
          const newStatus =
            newRetryCount >= batch.maxRetries ? 'failed' : 'pending';
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          await this.batchRepository.update(batchId, {
            batchStatus: newStatus,
            retryCount: newRetryCount,
            errorMessage: errorMessage,
          });

          this.logger.error(
            `Batch ${batchId} failed (retry ${newRetryCount}/${batch.maxRetries}). Status: ${newStatus}`,
          );
        }
        throw error;
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process batch download for user ${this.idMasker.maskUserId(userId)}:`,
        error,
      );

      throw error;
    }
  }

  /**
   * Create a Nautilus job to process the quilt after successful upload
   */
  private async createNautilusJob(
    userId: string,
    onChainBlobObjectId: string,
    quiltBlobId: string,
  ): Promise<void> {
    try {
      const submissionConfig = this.configService.getOrThrow<SubmissionConfig>(
        'submission',
        { infer: true },
      );

      // Look up user by socialId (submission userId maps to user.socialId)
      // Try common providers - adjust based on your submission system
      const user = await this.usersService.findBySocialIdAndProvider({
        socialId: userId,
        provider: AuthProvidersEnum.telegram,
      });

      // If not found with telegram, try other providers or fallback
      if (!user) {
        // Try other common providers if needed
        // For now, we'll log a warning and skip job creation
        this.logger.warn(
          `User with socialId ${this.idMasker.maskUserId(userId)} not found in user table. Skipping Nautilus job creation.`,
        );
        return;
      }

      const jobId = await this.jobProducerService.createDataRefinementJob(
        user.id, // Use the integer user ID from the user table
        {
          blobId: quiltBlobId, // Quilt blob ID for retrieving from Walrus
          onchainFileId: onChainBlobObjectId, // On-chain blob object ID
          policyId: submissionConfig.policyObjectId,
          jobType: JobType.BOTH,
          priority: 5,
        },
      );

      this.logger.log(
        `Created Nautilus job ${jobId} for user ${user.id} (socialId: ${this.idMasker.maskUserId(userId)}) to process quilt ${quiltBlobId}`,
      );
    } catch (error) {
      // Log error but don't fail the batch processing
      this.logger.error(
        `Failed to create Nautilus job for user ${this.idMasker.maskUserId(userId)}:`,
        error,
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
}

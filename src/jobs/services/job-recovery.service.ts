import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobRepository } from '../infrastructure/persistence/job.repository';
import { PgBossQueueService } from './pg-boss-queue.service';
import { JobStatus } from '../enums/job-status.enum';
import { AllConfigType } from '../../config/config.type';
import { JobConfig } from '../config/job-config.type';

@Injectable()
export class JobRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(JobRecoveryService.name);

  constructor(
    private readonly jobRepository: JobRepository,
    private readonly pgBossQueue: PgBossQueueService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  onModuleInit() {
    // Delay recovery to allow other services to initialize
    setTimeout(async () => {
      await this.recoverStuckJobs();
    }, 5000); // 5 second delay
  }

  async recoverStuckJobs(): Promise<void> {
    try {
      const jobConfig = this.configService.get<JobConfig>('job', {
        infer: true,
      });
      const timeoutMinutes = jobConfig?.teeProcessTimeout || 10; // Default 10 minutes

      this.logger.log(
        `Starting job recovery for jobs stuck longer than ${timeoutMinutes} minutes`,
      );

      // Find jobs that have been processing for too long
      const stuckJobs = await this.jobRepository.findStuckJobs(timeoutMinutes);

      if (stuckJobs.length === 0) {
        this.logger.log('No stuck jobs found');
        return;
      }

      this.logger.warn(
        `Found ${stuckJobs.length} stuck jobs, attempting recovery...`,
      );

      let recoveredCount = 0;
      let failedCount = 0;

      for (const job of stuckJobs) {
        try {
          await this.recoverSingleJob(job);
          recoveredCount++;
        } catch (error) {
          failedCount++;
          this.logger.error(`Failed to recover job ${job.id}:`, error);
        }
      }

      this.logger.log(
        `Job recovery completed: ${recoveredCount} recovered, ${failedCount} failed`,
      );
    } catch (error) {
      this.logger.error('Job recovery process failed:', error);
    }
  }

  private async recoverSingleJob(job: any): Promise<void> {
    this.logger.log(
      `Recovering stuck job ${job.id} (started at ${job.startedAt})`,
    );

    try {
      // Strategy 1: Try to requeue the job if it has a pg-boss job ID
      if (job.pgBossJobId) {
        // Check if pg-boss job still exists and is active
        try {
          const pgBossJob = await this.pgBossQueue.getJobStatus(
            job.pgBossJobId,
          );
          if (pgBossJob && pgBossJob.state === 'active') {
            // Job is still active in pg-boss, might be legitimately processing
            this.logger.warn(
              `Job ${job.id} is still active in pg-boss, skipping recovery`,
            );
            return;
          }
        } catch (error) {
          // pg-boss job not found or error, proceed with recovery
          this.logger.debug(
            `pg-boss job ${job.pgBossJobId} not found, proceeding with recovery: ${error.message}`,
          );
        }

        // Try to requeue the job
        try {
          const newPgBossJobId = await this.pgBossQueue.addJob(job.user.id, {
            customJobId: job.id,
            blobId: job.blobId,
            onchainFileId: job.onchainFileId,
            policyId: job.policyId,
            jobType: job.type,
            priority: job.priority,
            metadata: job.metadata,
          });

          // Update job status back to QUEUED with new pg-boss job ID
          await this.jobRepository.update(job.id, {
            status: JobStatus.QUEUED,
            pgBossJobId: newPgBossJobId,
            attempts: (job.attempts || 0) + 1,
            startedAt: new Date(), // Reset start time
            errorMessage: `Job recovered from stuck state after ${
              job.startedAt
                ? Math.round((Date.now() - job.startedAt.getTime()) / 60000)
                : 'unknown'
            } minutes`,
          });

          this.logger.log(
            `Successfully requeued stuck job ${job.id} with new pg-boss ID ${newPgBossJobId}`,
          );
          return;
        } catch (requeueError) {
          this.logger.warn(
            `Failed to requeue job ${job.id}, will mark as failed:`,
            requeueError,
          );
        }
      }

      // Strategy 2: Mark job as failed if requeuing failed or no pg-boss job ID
      await this.jobRepository.update(job.id, {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        errorMessage: `Job marked as failed during recovery - was stuck in processing state since ${job.startedAt}`,
        attempts: (job.attempts || 0) + 1,
      });

      this.logger.log(`Marked stuck job ${job.id} as failed`);
    } catch (error) {
      this.logger.error(`Error during recovery of job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Manual recovery method that can be called via API or admin interface
   */
  async triggerManualRecovery(): Promise<{
    recoveredCount: number;
    failedCount: number;
    totalStuckJobs: number;
  }> {
    const jobConfig = this.configService.get<JobConfig>('job', { infer: true });
    const timeoutMinutes = jobConfig?.teeProcessTimeout || 10;

    const stuckJobs = await this.jobRepository.findStuckJobs(timeoutMinutes);

    let recoveredCount = 0;
    let failedCount = 0;

    for (const job of stuckJobs) {
      try {
        await this.recoverSingleJob(job);
        recoveredCount++;
      } catch (error) {
        failedCount++;
        this.logger.error(`Failed to recover job ${job.id}:`, error);
      }
    }

    return {
      recoveredCount,
      failedCount,
      totalStuckJobs: stuckJobs.length,
    };
  }
}

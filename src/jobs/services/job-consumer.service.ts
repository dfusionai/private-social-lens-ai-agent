import { Injectable, Logger } from '@nestjs/common';
import { JobRepository } from '../infrastructure/persistence/job.repository';
import { JobStatus } from '../enums/job-status.enum';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../config/config.type';
import { JobConfig } from '../config/job-config.type';
import { NautilusService } from '../../nautilus/nautilus.service';
import { PgBossJob } from '../interfaces/job-data.interface';

@Injectable()
export class JobConsumerService {
  private readonly logger = new Logger(JobConsumerService.name);

  constructor(
    private readonly jobRepository: JobRepository,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly nautilusService: NautilusService,
  ) {}

  async processJob(jobs: PgBossJob[]): Promise<any[]> {
    this.logger.debug('Received jobs batch:', JSON.stringify(jobs, null, 2));

    if (!Array.isArray(jobs) || jobs.length === 0) {
      this.logger.error('No jobs received or invalid job format');
      throw new Error('No jobs received or invalid job format');
    }

    const results: any[] = [];
    const jobConfig = this.configService.get<JobConfig>('job', { infer: true });
    const workerId = jobConfig?.workerInstanceId || 'unknown';

    // Process each job in the batch
    for (const job of jobs) {
      const startTime = Date.now();

      try {
        if (!job.data) {
          this.logger.error('Job data is undefined for job:', job.id);
          throw new Error(`Job data is undefined for job ${job.id}`);
        }

        const {
          userId,
          customJobId,
          blobId,
          onchainFileId,
          policyId,
          jobType,
        } = job.data;

        this.logger.log(
          `Processing job ${customJobId} (${job.id}) for user ${userId} with type ${jobType}`,
        );

        // Update job status to processing
        await this.updateJobStatus(customJobId, JobStatus.PROCESSING, {
          startedAt: new Date(),
          workerId,
          pgBossJobId: job.id,
        });

        // Process data using Nautilus TEE service
        const result = await this.nautilusService.processData({
          payload: {
            blobId,
            onchainFileId,
            policyId,
            timeout_secs: 120,
          },
        });

        if (result.status !== 'success') {
          throw new Error(`TEE processing failed: ${result.message}`);
        }

        // Save result and update status
        await this.updateJobStatus(customJobId, JobStatus.COMPLETED, {
          resultData: result.data,
          completedAt: new Date(),
        });

        const duration = Date.now() - startTime;
        this.logger.log(
          `Job ${customJobId} (${job.id}) completed successfully in ${duration}ms`,
        );

        results.push({
          jobId: job.id,
          customJobId,
          success: true,
          result: result.data,
          duration,
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        const customJobId = job.data?.customJobId || 'unknown';

        await this.updateJobStatus(customJobId, JobStatus.FAILED, {
          errorMessage: error.message,
          failedAt: new Date(),
        });

        this.logger.error(
          `Job ${customJobId} (${job.id}) failed after ${duration}ms:`,
          error,
        );

        results.push({
          jobId: job.id,
          customJobId,
          success: false,
          error: error.message,
          duration,
        });
        // Don't throw here - continue processing other jobs in the batch
      }
    }

    return results;
  }

  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    additionalData: any = {},
  ): Promise<void> {
    try {
      await this.jobRepository.update(jobId, {
        status,
        ...additionalData,
      });
    } catch (error) {
      this.logger.error(
        `Failed to update job ${jobId} status to ${status}:`,
        error,
      );
      // Don't throw here as we don't want to fail the job processing due to status update issues
    }
  }

  async getProcessingStats(): Promise<{
    totalProcessed: number;
    averageProcessingTime: number;
    successRate: number;
  }> {
    try {
      // This is a simplified implementation
      // In production, you might want to use a proper metrics collection system
      const [completedJobs, failedJobs] = await Promise.all([
        this.jobRepository.countByStatus(JobStatus.COMPLETED),
        this.jobRepository.countByStatus(JobStatus.FAILED),
      ]);

      const totalProcessed = completedJobs + failedJobs;
      const successRate =
        totalProcessed > 0 ? (completedJobs / totalProcessed) * 100 : 0;

      return {
        totalProcessed,
        averageProcessingTime: 180000, // 3 minutes - this should be calculated from actual data
        successRate,
      };
    } catch (error) {
      this.logger.error('Failed to get processing stats:', error);
      return {
        totalProcessed: 0,
        averageProcessingTime: 0,
        successRate: 0,
      };
    }
  }
}

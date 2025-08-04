import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PgBossQueueService } from './pg-boss-queue.service';
import { JobRepository } from '../infrastructure/persistence/job.repository';
import { CreateJobDto } from '../dto/create-job.dto';
import { JobStatusDto } from '../dto/job-status.dto';
import { FindJobsDto } from '../dto/find-jobs.dto';
import { LatestCompletedJobDto } from '../dto/latest-completed-job.dto';
import { Job } from '../domain/job';
import { JobStatus } from '../enums/job-status.enum';
import { InfinityPaginationResponseDto } from '../../utils/dto/infinity-pagination-response.dto';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/domain/user';

@Injectable()
export class JobProducerService {
  private readonly logger = new Logger(JobProducerService.name);

  constructor(
    private readonly pgBossQueue: PgBossQueueService,
    private readonly jobRepository: JobRepository,
    private readonly usersService: UsersService,
  ) {}

  async createDataRefinementJob(
    userId: number | string,
    createJobDto: CreateJobDto,
  ): Promise<string> {
    try {
      // 1. Find the user first
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new NotFoundException(`User with id ${userId} not found`);
      }

      // 2. Save job metadata to custom table with user entity
      const job = new Job({
        user,
        type: createJobDto.jobType,
        status: JobStatus.PENDING,
        blobId: createJobDto.blobId,
        onchainFileId: createJobDto.onchainFileId,
        policyId: createJobDto.policyId,
        priority: createJobDto.priority,
        metadata: createJobDto.metadata,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
      });

      const savedJob = await this.jobRepository.create(job);

      // 3. Queue job to pg-boss for processing
      const pgBossJobId = await this.pgBossQueue.addJob(user.id, {
        customJobId: savedJob.id,
        ...createJobDto,
      });

      // 4. Update custom table with pg-boss job ID
      await this.jobRepository.update(savedJob.id, {
        pgBossJobId,
        status: JobStatus.QUEUED,
      });

      this.logger.log(`Created job ${savedJob.id} for user ${userId}`);
      return savedJob.id;
    } catch (error) {
      this.logger.error('Failed to create job:', error);
      throw new Error(`Failed to create data refinement job: ${error.message}`);
    }
  }

  async getJobStatus(
    jobId: string,
    userId: number | string,
  ): Promise<JobStatusDto> {
    const job = await this.jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Get additional status from pg-boss if available (for future use)
    if (job.pgBossJobId) {
      try {
        await this.pgBossQueue.getJobStatus(job.pgBossJobId);
      } catch (error) {
        this.logger.warn(
          `Could not get pg-boss status for job ${jobId}:`,
          error,
        );
      }
    }

    return {
      id: job.id,
      status: job.status,
      progress: this.calculateProgress(job),
      result: job.resultData,
      error: job.errorMessage,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      estimatedCompletion: this.calculateEstimatedCompletion(job) || undefined,
      canCancel:
        job.status === JobStatus.PENDING || job.status === JobStatus.QUEUED,
    };
  }

  async findUserJobs(
    userId: number | string,
    query: FindJobsDto,
  ): Promise<InfinityPaginationResponseDto<JobStatusDto>> {
    const jobs = await this.jobRepository.findAllWithPagination({
      userId,
      status: query.status,
      type: query.type,
      paginationOptions: {
        page: query.page,
        limit: query.limit,
      },
    });

    const jobStatuses = jobs.map((job) => this.mapJobToStatusDto(job));

    // Get total count for pagination
    const totalJobs = await this.jobRepository.findAllWithPagination({
      userId,
      status: query.status,
      type: query.type,
      paginationOptions: { page: 1, limit: 1000000 }, // Large limit to get all
    });

    return {
      data: jobStatuses,
      hasNextPage: query.page * query.limit < totalJobs.length,
    };
  }

  async cancelJob(jobId: string, userId: number | string): Promise<boolean> {
    const job = await this.jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== JobStatus.PENDING && job.status !== JobStatus.QUEUED) {
      throw new BadRequestException(
        'Job cannot be cancelled in current status',
      );
    }

    try {
      // Cancel in pg-boss if queued
      if (job.pgBossJobId) {
        await this.pgBossQueue.cancelJob(job.pgBossJobId);
      }

      // Update status in custom table
      await this.jobRepository.update(jobId, {
        status: JobStatus.CANCELLED,
        completedAt: new Date(),
      });

      this.logger.log(`Cancelled job ${jobId} for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  async getLatestCompletedJob(
    userId: User['id'],
  ): Promise<LatestCompletedJobDto> {
    const latestJob =
      await this.jobRepository.findLatestCompletedByUserId(userId);

    return {
      latestCompletedAt: latestJob?.completedAt
        ? latestJob.completedAt.toISOString()
        : null,
    };
  }

  private calculateProgress(job: Job): number {
    switch (job.status) {
      case JobStatus.PENDING:
      case JobStatus.QUEUED:
        return 0;
      case JobStatus.PROCESSING:
        // Could be enhanced with actual progress from TEE
        return 50;
      case JobStatus.COMPLETED:
        return 100;
      case JobStatus.FAILED:
      case JobStatus.CANCELLED:
        return 0;
      default:
        return 0;
    }
  }

  private calculateEstimatedCompletion(job: Job): Date | null {
    if (
      job.status === JobStatus.COMPLETED ||
      job.status === JobStatus.FAILED ||
      job.status === JobStatus.CANCELLED
    ) {
      return null;
    }

    // If job is processing, estimate based on start time
    if (job.status === JobStatus.PROCESSING && job.startedAt) {
      const processingType = job.type || 'refinement';
      // Use a default data size since we no longer have actual file data
      const defaultDataSize = 1024 * 1024; // 1MB default
      const estimatedTime = this.estimateProcessingTime(
        defaultDataSize,
        processingType,
      );
      return new Date(job.startedAt.getTime() + estimatedTime);
    }

    // For pending jobs, estimate based on queue position and average processing time
    const avgProcessingTime = 3 * 60 * 1000; // 3 minutes in milliseconds
    return new Date(Date.now() + avgProcessingTime);
  }

  estimateProcessingTime(dataSize: number, processingType: string): number {
    // Simple estimation based on data size and processing type
    // These could be refined based on actual metrics
    const baseTime = 30000; // 30 seconds base processing time
    const sizeMultiplier = Math.ceil(dataSize / 1024 / 1024); // per MB

    let typeMultiplier = 1;
    switch (processingType) {
      case 'refinement':
        typeMultiplier = 1.5;
        break;
      case 'embedding':
        typeMultiplier = 1.2;
        break;
      case 'both':
        typeMultiplier = 2.0;
        break;
      default:
        typeMultiplier = 1;
    }

    return baseTime * sizeMultiplier * typeMultiplier;
  }

  private mapJobToStatusDto(job: Job): JobStatusDto {
    return {
      id: job.id,
      status: job.status,
      progress: this.calculateProgress(job),
      result: job.resultData,
      error: job.errorMessage,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      estimatedCompletion: this.calculateEstimatedCompletion(job) || undefined,
      canCancel:
        job.status === JobStatus.PENDING || job.status === JobStatus.QUEUED,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobRepository } from '../infrastructure/persistence/job.repository';
import { PgBossQueueService } from './pg-boss-queue.service';
import { QueueHealthDto } from '../dto/job-metrics.dto';
import { JobStatus } from '../enums/job-status.enum';
import { JobConsumerService } from './job-consumer.service';

@Injectable()
export class JobMonitoringService {
  private readonly logger = new Logger(JobMonitoringService.name);

  constructor(
    private readonly jobRepository: JobRepository,
    private readonly pgBossQueue: PgBossQueueService,
    private readonly jobConsumer: JobConsumerService,
  ) {}

  async getQueueHealth(): Promise<QueueHealthDto> {
    const [pendingCount, processingCount, stats, pgBossMetrics] =
      await Promise.all([
        this.jobRepository.countByStatus(JobStatus.PENDING),
        this.jobRepository.countByStatus(JobStatus.PROCESSING),
        this.jobConsumer.getProcessingStats(),
        this.pgBossQueue.getQueueMetrics(),
      ]);

    const totalQueueSize = pendingCount + pgBossMetrics.pendingCount;
    const totalProcessing = processingCount + pgBossMetrics.activeCount;

    const estimatedWaitTime = this.calculateEstimatedWaitTime(
      totalQueueSize,
      stats.averageProcessingTime,
    );

    return {
      queueSize: totalQueueSize,
      processing: totalProcessing,
      averageProcessingTime: stats.averageProcessingTime,
      estimatedWaitTime,
      isHealthy: totalQueueSize < 200 && totalProcessing > 0,
      lastUpdated: new Date(),
    };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupCompletedJobs() {
    try {
      this.logger.log('Starting cleanup of old completed jobs');

      // Remove completed jobs older than 7 days
      await this.jobRepository.removeOldCompletedJobs(7);

      this.logger.log('Completed cleanup of old completed jobs');
    } catch (error) {
      this.logger.error('Failed to cleanup completed jobs:', error);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async recoverStuckJobs() {
    try {
      this.logger.debug('Checking for stuck jobs');

      // Find jobs stuck in processing for > 10 minutes
      const stuckJobs = await this.jobRepository.findStuckJobs(10);

      if (stuckJobs.length > 0) {
        this.logger.warn(`Found ${stuckJobs.length} stuck jobs, recovering...`);

        for (const job of stuckJobs) {
          try {
            await this.jobRepository.update(job.id, {
              status: JobStatus.PENDING,
              workerId: undefined,
              startedAt: undefined,
              attempts: job.attempts + 1,
            });

            this.logger.log(`Recovered stuck job ${job.id}`);
          } catch (error) {
            this.logger.error(`Failed to recover stuck job ${job.id}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to recover stuck jobs:', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async logQueueMetrics() {
    try {
      const health = await this.getQueueHealth();

      this.logger.log(
        `Queue Health: ${health.queueSize} pending, ${health.processing} processing, ` +
          `${health.averageProcessingTime}ms avg time, healthy: ${health.isHealthy}`,
      );

      // Log warning if queue is growing too large
      if (health.queueSize > 100) {
        this.logger.warn(
          `Queue size is high: ${health.queueSize} jobs pending`,
        );
      }

      // Log error if no jobs are processing but queue has jobs
      if (health.queueSize > 0 && health.processing === 0) {
        this.logger.error(
          'Jobs in queue but none processing - possible worker issue',
        );
      }
    } catch (error) {
      this.logger.error('Failed to log queue metrics:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async generateHourlyReport() {
    try {
      const [completedLastHour, failedLastHour, pendingCount, processingCount] =
        await Promise.all([
          this.getJobsCountInLastHours(JobStatus.COMPLETED, 1),
          this.getJobsCountInLastHours(JobStatus.FAILED, 1),
          this.jobRepository.countByStatus(JobStatus.PENDING),
          this.jobRepository.countByStatus(JobStatus.PROCESSING),
        ]);

      const totalProcessed = completedLastHour + failedLastHour;
      const successRate =
        totalProcessed > 0 ? (completedLastHour / totalProcessed) * 100 : 0;

      this.logger.log(
        `Hourly Report: ${totalProcessed} jobs processed (${completedLastHour} completed, ` +
          `${failedLastHour} failed), ${successRate.toFixed(1)}% success rate. ` +
          `Current: ${pendingCount} pending, ${processingCount} processing`,
      );
    } catch (error) {
      this.logger.error('Failed to generate hourly report:', error);
    }
  }

  private calculateEstimatedWaitTime(
    queueSize: number,
    avgProcessingTime: number,
  ): number {
    if (queueSize === 0) return 0;

    // Estimate based on queue size and average processing time
    // Assuming some level of parallelism (e.g., 4 concurrent workers)
    const assumedConcurrency = 4;
    return Math.ceil(queueSize / assumedConcurrency) * avgProcessingTime;
  }

  private async getJobsCountInLastHours(
    status: JobStatus,
    hours: number,
  ): Promise<number> {
    // This is a simplified implementation
    // In a real scenario, you'd want to query jobs completed/failed in the last N hours
    // For now, we'll return a placeholder value
    try {
      const jobs = await this.jobRepository.findByStatus(status);
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      return jobs.filter((job) => {
        const timestamp = job.completedAt || job.failedAt || job.createdAt;
        return timestamp && timestamp > cutoffTime;
      }).length;
    } catch (error) {
      this.logger.error(
        `Failed to get ${status} jobs count for last ${hours} hours:`,
        error,
      );
      return 0;
    }
  }
}

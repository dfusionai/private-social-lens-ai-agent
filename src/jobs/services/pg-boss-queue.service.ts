import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss from 'pg-boss';
import { JobConsumerService } from './job-consumer.service';
import { CreateJobDto } from '../dto/create-job.dto';
import { AllConfigType } from '../../config/config.type';
import { JobConfig } from '../config/job-config.type';
import { DatabaseConfig } from '../../database/config/database-config.type';
import { createHash } from 'crypto';

@Injectable()
export class PgBossQueueService implements OnModuleInit, OnModuleDestroy {
  private boss: PgBoss;
  private readonly logger = new Logger(PgBossQueueService.name);

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly jobConsumer: JobConsumerService,
  ) {}

  async onModuleInit() {
    const databaseConfig = this.configService.get<DatabaseConfig>('database', {
      infer: true,
    });
    const jobConfig = this.configService.get<JobConfig>('job', { infer: true });

    // Support both connection string and separate database fields
    const pgBossConfig: any = {
      retryLimit: jobConfig?.maxRetries || 3,
      retryDelay: Math.floor((jobConfig?.retryDelay || 60000) / 1000), // pg-boss expects seconds
      expireInHours: 23, // Must be less than 24 hours
      maintenanceIntervalSeconds: Math.floor(
        (jobConfig?.pollInterval || 2000) / 1000,
      ),
    };

    if (databaseConfig?.url) {
      // Use connection string if available
      pgBossConfig.connectionString = databaseConfig.url;
    } else {
      // Use separate database connection fields
      pgBossConfig.host = databaseConfig?.host;
      pgBossConfig.port = databaseConfig?.port;
      pgBossConfig.database = databaseConfig?.name;
      pgBossConfig.user = databaseConfig?.username;
      pgBossConfig.password = databaseConfig?.password;

      // Add SSL configuration if enabled
      if (databaseConfig?.sslEnabled) {
        pgBossConfig.ssl = {
          rejectUnauthorized: databaseConfig?.rejectUnauthorized ?? true,
        };

        if (databaseConfig?.ca) pgBossConfig.ssl.ca = databaseConfig.ca;
        if (databaseConfig?.key) pgBossConfig.ssl.key = databaseConfig.key;
        if (databaseConfig?.cert) pgBossConfig.ssl.cert = databaseConfig.cert;
      }
    }

    this.boss = new PgBoss(pgBossConfig);

    this.boss.on('error', console.error);

    await this.boss.start();

    // Create the data-refinement queue
    await this.boss.createQueue('data-refinement');
    this.logger.log('Created data-refinement queue');

    // Register worker only if this instance should process jobs
    if (this.shouldRunWorker()) {
      await this.boss.work(
        'data-refinement',
        {
          batchSize: jobConfig?.workerCount || 1,
        },
        this.jobConsumer.processJob.bind(this.jobConsumer),
      );

      this.logger.log(
        `pg-boss worker initialized with ${jobConfig?.workerCount || 1} workers`,
      );
    } else {
      this.logger.log('pg-boss initialized as API-only instance (no workers)');
    }

    this.logger.log(
      `pg-boss initialized with instance ID: ${jobConfig?.workerInstanceId || `worker-${Date.now()}`}`,
    );
  }

  async onModuleDestroy() {
    if (this.boss) {
      await this.boss.stop();
      this.logger.log('pg-boss stopped');
    }
  }

  async addJob(
    userId: number | string,
    data: CreateJobDto & { customJobId: string },
  ): Promise<string> {
    const jobData = {
      userId,
      customJobId: data.customJobId,
      blobId: data.blobId,
      onchainFileId: data.onchainFileId,
      policyId: data.policyId,
      jobType: data.jobType,
      priority: data.priority,
      metadata: data.metadata,
    };

    // Sanitize job data to remove circular references and non-serializable objects
    const sanitizedJobData = this.sanitizeJobData(jobData);

    this.logger.debug(`Original job data:`, jobData);
    this.logger.debug(`Sanitized job data:`, sanitizedJobData);

    const jobConfig = this.configService.get<JobConfig>('job', { infer: true });
    const singletonKey = `user-${userId}-${this.hashData(data)}`;

    this.logger.debug(`Attempting to queue job with data:`, {
      userId,
      customJobId: data.customJobId,
      singletonKey,
    });

    try {
      const jobId = await this.boss.send('data-refinement', sanitizedJobData, {
        priority: data.priority || 5,
        retryLimit: jobConfig?.maxRetries || 3,
        retryDelay: Math.floor((jobConfig?.retryDelay || 60000) / 1000),
        expireInHours: 23,
        singletonKey, // Use singleton key to prevent duplicates
      });

      if (!jobId) {
        // PgBoss returns null when a job with the same singleton key already exists
        // Let's try without singleton key as a fallback
        this.logger.warn(
          `Job with singletonKey ${singletonKey} already exists, retrying without singleton`,
          {
            sanitizedJobData,
            singletonKey,
          },
        );
        throw new Error(`Job with singletonKey ${singletonKey} already exists`);
      }

      this.logger.log(`Queued job ${jobId} for user ${userId}`);
      return jobId;
    } catch (error) {
      this.logger.error('Error queuing job to PgBoss:', {
        error: error.message,
        stack: error.stack,
        jobData,
        singletonKey,
      });
      throw new Error(`Failed to queue job: ${error.message}`);
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    return await this.boss.getJobById('data-refinement', jobId);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      await this.boss.cancel('data-refinement', jobId);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel pg-boss job ${jobId}:`, error);
      return false;
    }
  }

  async getQueueMetrics(): Promise<{
    pendingCount: number;
    activeCount: number;
    completedCount: number;
    failedCount: number;
  }> {
    const [pending, active, completed, failed] = await Promise.all([
      this.boss.getQueueSize('data-refinement'),
      this.boss.getQueueSize('data-refinement'),
      this.boss.getQueueSize('data-refinement'),
      this.boss.getQueueSize('data-refinement'),
    ]);

    return {
      pendingCount: pending,
      activeCount: active,
      completedCount: completed,
      failedCount: failed,
    };
  }

  private shouldRunWorker(): boolean {
    const jobConfig = this.configService.get<JobConfig>('job', { infer: true });
    const workerRole = jobConfig?.workerRole || 'api+worker';
    return workerRole === 'worker' || workerRole === 'api+worker';
  }

  private sanitizeJobData(data: any): any {
    const seen = new WeakSet();

    const sanitize = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }

      // Handle circular references
      if (seen.has(obj)) {
        return '[Circular]';
      }
      seen.add(obj);

      // Handle Date objects
      if (obj instanceof Date) {
        return obj.toISOString();
      }

      // Skip Node.js internal objects (like Timeout, TimersList)
      if (
        obj.constructor &&
        obj.constructor.name &&
        ['Timeout', 'TimersList', 'Timer'].includes(obj.constructor.name)
      ) {
        return '[Internal Object]';
      }

      // Handle arrays
      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      // Handle plain objects
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          try {
            sanitized[key] = sanitize(obj[key]);
          } catch {
            // Skip properties that can't be serialized
            sanitized[key] = '[Non-serializable]';
          }
        }
      }

      return sanitized;
    };

    return sanitize(data);
  }

  private hashData(data: any): string {
    const sanitizedData = this.sanitizeJobData(data);
    return createHash('md5')
      .update(JSON.stringify(sanitizedData))
      .digest('hex')
      .substring(0, 8);
  }
}

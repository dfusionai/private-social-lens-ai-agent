import { registerAs } from '@nestjs/config';
import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import validateConfig from '../../utils/validate-config';
import { JobConfig } from './job-config.type';

class EnvironmentVariablesValidator {
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  JOB_WORKER_COUNT: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  JOB_POLL_INTERVAL: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  JOB_MAX_RETRIES: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  JOB_RETRY_DELAY: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  TEE_PROCESS_TIMEOUT: number;

  @IsOptional()
  @IsString()
  WORKER_INSTANCE_ID: string;

  @IsOptional()
  @IsEnum(['api', 'worker', 'api+worker'])
  WORKER_ROLE: 'api' | 'worker' | 'api+worker';
}

export default registerAs<JobConfig>('job', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    workerCount: process.env.JOB_WORKER_COUNT
      ? parseInt(process.env.JOB_WORKER_COUNT, 10)
      : 1,
    pollInterval: process.env.JOB_POLL_INTERVAL
      ? parseInt(process.env.JOB_POLL_INTERVAL, 10)
      : 2000,
    maxRetries: process.env.JOB_MAX_RETRIES
      ? parseInt(process.env.JOB_MAX_RETRIES, 10)
      : 3,
    retryDelay: process.env.JOB_RETRY_DELAY
      ? parseInt(process.env.JOB_RETRY_DELAY, 10)
      : 60000,
    teeProcessTimeout: process.env.TEE_PROCESS_TIMEOUT
      ? parseInt(process.env.TEE_PROCESS_TIMEOUT, 10)
      : 480000,
    workerInstanceId:
      process.env.WORKER_INSTANCE_ID ||
      `worker-${process.env.HOSTNAME || 'local'}-${Date.now()}`,
    workerRole:
      (process.env.WORKER_ROLE as 'api' | 'worker' | 'api+worker') ||
      'api+worker',
  };
});

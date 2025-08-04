export type JobConfig = {
  enabled?: boolean;
  workerCount?: number;
  pollInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  teeProcessTimeout?: number;
  teeMaxConcurrent?: number;
  teeBatchSize?: number;
  workerInstanceId?: string;
  workerRole?: 'api' | 'worker' | 'api+worker';
};

export type JobConfig = {
  workerCount?: number;
  pollInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  teeProcessTimeout?: number;
  workerInstanceId?: string;
  workerRole?: 'api' | 'worker' | 'api+worker';
};

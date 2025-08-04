import { Exclude, Expose } from 'class-transformer';
import { JobStatus } from '../enums/job-status.enum';
import { JobType } from '../enums/job-type.enum';
import { User } from '../../users/domain/user';

export class Job {
  @Expose()
  id: string;

  @Expose()
  user: User;

  @Expose()
  type: JobType;

  @Expose()
  status: JobStatus;

  @Expose()
  blobId: string;

  @Expose()
  onchainFileId: string;

  @Expose()
  policyId: string;

  @Expose()
  priority?: number;

  @Expose()
  metadata?: Record<string, any>;

  @Expose()
  resultData?: any;

  @Expose()
  errorMessage?: string;

  @Expose()
  workerId?: string;

  @Expose()
  attempts: number;

  @Expose()
  maxAttempts: number;

  @Expose()
  pgBossJobId?: string;

  @Expose()
  createdAt: Date;

  @Expose()
  startedAt?: Date;

  @Expose()
  completedAt?: Date;

  @Expose()
  failedAt?: Date;

  @Expose()
  updatedAt?: Date;

  @Exclude()
  deletedAt?: Date;

  constructor(partial: Partial<Job>) {
    Object.assign(this, partial);
  }
}

import { Exclude, Expose } from 'class-transformer';

export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';

export class Batch {
  @Expose()
  id: string;

  @Expose()
  userId: string;

  @Expose()
  batchNumber: number;

  @Expose()
  chatCount: number;

  @Expose()
  batchStatus: BatchStatus;

  @Expose()
  retryCount: number;

  @Expose()
  maxRetries: number;

  @Expose()
  errorMessage?: string;

  @Expose()
  quiltId?: string;

  @Expose()
  quiltBlobId?: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt?: Date;

  constructor(partial: Partial<Batch>) {
    Object.assign(this, partial);
  }
}


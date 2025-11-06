import { Exclude, Expose } from 'class-transformer';

export class UserBatchTracking {
  @Expose()
  id: string;

  @Expose()
  userId: string;

  @Expose()
  chatCount: number;

  @Expose()
  batchStatus: 'pending' | 'processing' | 'completed';

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt?: Date;

  @Exclude()
  deletedAt?: Date;

  constructor(partial: Partial<UserBatchTracking>) {
    Object.assign(this, partial);
  }
}

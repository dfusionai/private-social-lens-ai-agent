import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Job } from '../../domain/job';
import { JobStatus } from '../../enums/job-status.enum';
import { JobType } from '../../enums/job-type.enum';

export abstract class JobRepository {
  abstract create(
    data: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Job>;

  abstract findAllWithPagination({
    userId,
    status,
    type,
    paginationOptions,
  }: {
    userId?: number | string;
    status?: JobStatus;
    type?: JobType;
    paginationOptions: IPaginationOptions;
  }): Promise<Job[]>;

  abstract findById(id: Job['id']): Promise<NullableType<Job>>;

  abstract findByIdAndUserId(
    id: Job['id'],
    userId: number | string,
  ): Promise<NullableType<Job>>;

  abstract findByIds(ids: Job['id'][]): Promise<Job[]>;

  abstract findByStatus(status: JobStatus): Promise<Job[]>;

  abstract findStuckJobs(timeoutMinutes: number): Promise<Job[]>;

  abstract countByStatus(status: JobStatus): Promise<number>;

  abstract update(
    id: Job['id'],
    payload: DeepPartial<Job>,
  ): Promise<Job | null>;

  abstract remove(id: Job['id']): Promise<void>;

  abstract removeOldCompletedJobs(olderThanDays: number): Promise<void>;
}

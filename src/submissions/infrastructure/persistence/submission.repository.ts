import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { Submission } from '../../domain/submission';

export abstract class SubmissionRepository {
  abstract create(
    data: Omit<Submission, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Submission>;

  abstract findById(id: Submission['id']): Promise<NullableType<Submission>>;

  abstract findByUserId(userId: number | string): Promise<Submission[]>;

  abstract findByUserAndBatchStatus(
    userId: number | string,
    batchStatus: string,
  ): Promise<Submission[]>;

  abstract update(
    id: Submission['id'],
    payload: DeepPartial<Submission>,
  ): Promise<Submission | null>;

  abstract remove(id: Submission['id']): Promise<void>;
}

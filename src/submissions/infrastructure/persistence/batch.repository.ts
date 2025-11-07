import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { Batch, BatchStatus } from '../../domain/batch';

export abstract class BatchRepository {
  abstract create(
    data: Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Batch>;

  abstract findById(id: Batch['id']): Promise<NullableType<Batch>>;

  abstract findByUserId(userId: string | number): Promise<Batch[]>;

  abstract findLatestByUserId(userId: string | number): Promise<NullableType<Batch>>;

  abstract findByUserIdAndStatus(
    userId: string | number,
    status: BatchStatus,
  ): Promise<Batch[]>;

  abstract update(
    id: Batch['id'],
    payload: DeepPartial<Batch>,
  ): Promise<Batch | null>;
}


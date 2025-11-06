import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { UserBatchTracking } from '../../domain/user-batch-tracking';

export abstract class UserBatchTrackingRepository {
  abstract create(
    data: Omit<UserBatchTracking, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UserBatchTracking>;

  abstract findByUserId(
    userId: number | string,
  ): Promise<NullableType<UserBatchTracking>>;

  abstract update(
    id: UserBatchTracking['id'],
    payload: DeepPartial<UserBatchTracking>,
  ): Promise<UserBatchTracking | null>;

  abstract upsertByUserId(
    userId: number | string,
    payload: DeepPartial<UserBatchTracking>,
  ): Promise<UserBatchTracking>;
}

import { UserBatchTracking } from '../../../../domain/user-batch-tracking';
import { UserBatchTrackingEntity } from '../entities/user-batch-tracking.entity';

export class UserBatchTrackingMapper {
  static toDomain(raw: UserBatchTrackingEntity): UserBatchTracking {
    const domainEntity = new UserBatchTracking({
      id: raw.id,
      userId: raw.userId,
      chatCount: raw.chatCount,
      batchStatus: raw.batchStatus,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });

    return domainEntity;
  }

  static toPersistence(
    domainEntity: UserBatchTracking,
  ): UserBatchTrackingEntity {
    const persistenceEntity = new UserBatchTrackingEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.userId = domainEntity.userId;
    persistenceEntity.chatCount = domainEntity.chatCount;
    persistenceEntity.batchStatus = domainEntity.batchStatus;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}

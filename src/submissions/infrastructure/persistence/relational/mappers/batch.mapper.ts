import { Batch } from '../../../../domain/batch';
import { BatchEntity } from '../entities/batch.entity';

export class BatchMapper {
  static toDomain(raw: BatchEntity): Batch {
    const domainEntity = new Batch({
      id: raw.id,
      userId: raw.userId,
      batchNumber: raw.batchNumber,
      chatCount: raw.chatCount,
      batchStatus: raw.batchStatus,
      retryCount: raw.retryCount,
      maxRetries: raw.maxRetries,
      errorMessage: raw.errorMessage,
      quiltId: raw.quiltId,
      quiltBlobId: raw.quiltBlobId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });

    return domainEntity;
  }

  static toPersistence(domainEntity: Batch): BatchEntity {
    const persistenceEntity = new BatchEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.userId = domainEntity.userId;
    persistenceEntity.batchNumber = domainEntity.batchNumber;
    persistenceEntity.chatCount = domainEntity.chatCount;
    persistenceEntity.batchStatus = domainEntity.batchStatus;
    persistenceEntity.retryCount = domainEntity.retryCount;
    persistenceEntity.maxRetries = domainEntity.maxRetries;
    persistenceEntity.errorMessage = domainEntity.errorMessage;
    persistenceEntity.quiltId = domainEntity.quiltId;
    persistenceEntity.quiltBlobId = domainEntity.quiltBlobId;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}


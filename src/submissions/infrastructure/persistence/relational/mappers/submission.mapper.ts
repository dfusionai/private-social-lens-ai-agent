import { Submission } from '../../../../domain/submission';
import { SubmissionEntity } from '../entities/submission.entity';

export class SubmissionMapper {
  static toDomain(raw: SubmissionEntity): Submission {
    const domainEntity = new Submission({
      id: raw.id,
      userId: raw.userId,
      blobUrl: raw.blobUrl,
      blobName: raw.blobName,
      chatCount: raw.chatCount,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });

    return domainEntity;
  }

  static toPersistence(domainEntity: Submission): SubmissionEntity {
    const persistenceEntity = new SubmissionEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.userId = domainEntity.userId;
    persistenceEntity.blobUrl = domainEntity.blobUrl;
    persistenceEntity.blobName = domainEntity.blobName;
    persistenceEntity.chatCount = domainEntity.chatCount;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}

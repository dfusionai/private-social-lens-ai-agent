import { Job } from '../../../../domain/job';
import { UserMapper } from '../../../../../users/infrastructure/persistence/relational/mappers/user.mapper';
import { JobEntity } from '../entities/job.entity';

export class JobMapper {
  static toDomain(raw: JobEntity): Job {
    const domainEntity = new Job({
      id: raw.id,
      user: raw.user ? UserMapper.toDomain(raw.user) : undefined,
      type: raw.type,
      status: raw.status,
      blobId: raw.blobId,
      onchainFileId: raw.onchainFileId,
      policyId: raw.policyId,
      priority: raw.priority,
      metadata: raw.metadata,
      resultData: raw.resultData,
      errorMessage: raw.errorMessage,
      workerId: raw.workerId,
      attempts: raw.attempts,
      maxAttempts: raw.maxAttempts,
      pgBossJobId: raw.pgBossJobId,
      startedAt: raw.startedAt,
      completedAt: raw.completedAt,
      failedAt: raw.failedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });

    return domainEntity;
  }

  static toPersistence(domainEntity: Job): JobEntity {
    const persistenceEntity = new JobEntity();

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }

    persistenceEntity.type = domainEntity.type;
    persistenceEntity.status = domainEntity.status;
    persistenceEntity.blobId = domainEntity.blobId;
    persistenceEntity.onchainFileId = domainEntity.onchainFileId;
    persistenceEntity.policyId = domainEntity.policyId;
    persistenceEntity.priority = domainEntity.priority;
    persistenceEntity.metadata = domainEntity.metadata;
    persistenceEntity.resultData = domainEntity.resultData;
    persistenceEntity.errorMessage = domainEntity.errorMessage;
    persistenceEntity.workerId = domainEntity.workerId;
    persistenceEntity.attempts = domainEntity.attempts;
    persistenceEntity.maxAttempts = domainEntity.maxAttempts;
    persistenceEntity.pgBossJobId = domainEntity.pgBossJobId;
    persistenceEntity.startedAt = domainEntity.startedAt;
    persistenceEntity.completedAt = domainEntity.completedAt;
    persistenceEntity.failedAt = domainEntity.failedAt;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    if (domainEntity.user) {
      persistenceEntity.user = UserMapper.toPersistence(domainEntity.user);
    }

    return persistenceEntity;
  }
}

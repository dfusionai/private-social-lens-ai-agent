import { tokenGatingConfig } from '../../../../domain/token-gating-config';
import { tokenGatingConfigEntity } from '../entities/token-gating-config.entity';

export class tokenGatingConfigMapper {
  static toDomain(raw: tokenGatingConfigEntity): tokenGatingConfig {
    const domainEntity = new tokenGatingConfig();
    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.stakeThreshold = raw.stakeThreshold;
    domainEntity.balanceThreshold = raw.balanceThreshold;

    return domainEntity;
  }

  static toPersistence(
    domainEntity: tokenGatingConfig,
  ): tokenGatingConfigEntity {
    const persistenceEntity = new tokenGatingConfigEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.stakeThreshold = domainEntity.stakeThreshold;
    persistenceEntity.balanceThreshold = domainEntity.balanceThreshold;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBatchTrackingEntity } from '../entities/user-batch-tracking.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { UserBatchTracking } from '../../../../domain/user-batch-tracking';
import { UserBatchTrackingRepository } from '../../user-batch-tracking.repository';
import { UserBatchTrackingMapper } from '../mappers/user-batch-tracking.mapper';

@Injectable()
export class UserBatchTrackingRelationalRepository
  implements UserBatchTrackingRepository
{
  constructor(
    @InjectRepository(UserBatchTrackingEntity)
    private readonly userBatchTrackingRepository: Repository<UserBatchTrackingEntity>,
  ) {}

  async create(data: UserBatchTracking): Promise<UserBatchTracking> {
    const persistenceModel = UserBatchTrackingMapper.toPersistence(data);
    const newEntity = await this.userBatchTrackingRepository.save(
      this.userBatchTrackingRepository.create(persistenceModel),
    );
    return UserBatchTrackingMapper.toDomain(newEntity);
  }

  async findByUserId(
    userId: number | string,
  ): Promise<NullableType<UserBatchTracking>> {
    const entity = await this.userBatchTrackingRepository.findOne({
      where: { userId: userId.toString() },
    });

    return entity ? UserBatchTrackingMapper.toDomain(entity) : null;
  }

  async update(
    id: UserBatchTracking['id'],
    payload: Partial<UserBatchTracking>,
  ): Promise<UserBatchTracking> {
    const entity = await this.userBatchTrackingRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.userBatchTrackingRepository.save(
      this.userBatchTrackingRepository.create(
        UserBatchTrackingMapper.toPersistence({
          ...UserBatchTrackingMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return UserBatchTrackingMapper.toDomain(updatedEntity);
  }

  async upsertByUserId(
    userId: number | string,
    payload: Partial<UserBatchTracking>,
  ): Promise<UserBatchTracking> {
    const existing = await this.findByUserId(userId);

    if (existing) {
      return this.update(existing.id, payload);
    } else {
      // Create new tracking record
      const newTracking = new UserBatchTracking({
        userId: userId.toString(),
        chatCount: payload.chatCount || 0,
        batchStatus: (payload.batchStatus as any) || 'pending',
      });
      return this.create(newTracking);
    }
  }
}

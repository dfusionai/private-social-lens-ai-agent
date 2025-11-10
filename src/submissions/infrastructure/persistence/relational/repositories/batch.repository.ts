import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BatchEntity } from '../entities/batch.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Batch, BatchStatus } from '../../../../domain/batch';
import { BatchRepository } from '../../batch.repository';
import { BatchMapper } from '../mappers/batch.mapper';

@Injectable()
export class BatchRelationalRepository implements BatchRepository {
  constructor(
    @InjectRepository(BatchEntity)
    private readonly batchRepository: Repository<BatchEntity>,
  ) {}

  async create(data: Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>): Promise<Batch> {
    const persistenceModel = BatchMapper.toPersistence(
      new Batch(data as Partial<Batch>),
    );
    const newEntity = await this.batchRepository.save(
      this.batchRepository.create(persistenceModel),
    );
    return BatchMapper.toDomain(newEntity);
  }

  async findById(id: Batch['id']): Promise<NullableType<Batch>> {
    const entity = await this.batchRepository.findOne({
      where: { id },
    });

    return entity ? BatchMapper.toDomain(entity) : null;
  }

  async findByUserId(userId: string | number): Promise<Batch[]> {
    const entities = await this.batchRepository.find({
      where: { userId: userId.toString() },
      order: {
        batchNumber: 'DESC',
      },
    });

    return entities.map((entity) => BatchMapper.toDomain(entity));
  }

  async findLatestByUserId(userId: string | number): Promise<NullableType<Batch>> {
    const entity = await this.batchRepository.findOne({
      where: { userId: userId.toString() },
      order: {
        batchNumber: 'DESC',
      },
    });

    return entity ? BatchMapper.toDomain(entity) : null;
  }

  async findByUserIdAndStatus(
    userId: string | number,
    status: BatchStatus,
  ): Promise<Batch[]> {
    const entities = await this.batchRepository.find({
      where: {
        userId: userId.toString(),
        batchStatus: status,
      },
      order: {
        batchNumber: 'DESC',
      },
    });

    return entities.map((entity) => BatchMapper.toDomain(entity));
  }

  async update(
    id: Batch['id'],
    payload: Partial<Batch>,
  ): Promise<Batch | null> {
    const entity = await this.batchRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.batchRepository.save(
      this.batchRepository.create(
        BatchMapper.toPersistence({
          ...BatchMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return BatchMapper.toDomain(updatedEntity);
  }
}


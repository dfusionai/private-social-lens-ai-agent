import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { tokenGatingConfigEntity } from '../entities/token-gating-config.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { tokenGatingConfig } from '../../../../domain/token-gating-config';
import { tokenGatingConfigRepository } from '../../token-gating-config.repository';
import { tokenGatingConfigMapper } from '../mappers/token-gating-config.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class tokenGatingConfigRelationalRepository
  implements tokenGatingConfigRepository
{
  constructor(
    @InjectRepository(tokenGatingConfigEntity)
    private readonly tokenGatingConfigRepository: Repository<tokenGatingConfigEntity>,
  ) {}

  async create(data: tokenGatingConfig): Promise<tokenGatingConfig> {
    const persistenceModel = tokenGatingConfigMapper.toPersistence(data);
    const newEntity = await this.tokenGatingConfigRepository.save(
      this.tokenGatingConfigRepository.create(persistenceModel),
    );
    return tokenGatingConfigMapper.toDomain(newEntity);
  }

  async getLatestConfig(): Promise<tokenGatingConfig> {
    const entities = await this.tokenGatingConfigRepository.find({
      order: { createdAt: 'DESC' },
      take: 1,
    });

    if (!entities || entities.length === 0) {
      throw new Error('No token gating config found');
    }

    return tokenGatingConfigMapper.toDomain(entities[0]);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<tokenGatingConfig[]> {
    const entities = await this.tokenGatingConfigRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => tokenGatingConfigMapper.toDomain(entity));
  }

  async findById(
    id: tokenGatingConfig['id'],
  ): Promise<NullableType<tokenGatingConfig>> {
    const entity = await this.tokenGatingConfigRepository.findOne({
      where: { id },
    });

    return entity ? tokenGatingConfigMapper.toDomain(entity) : null;
  }

  async findByIds(
    ids: tokenGatingConfig['id'][],
  ): Promise<tokenGatingConfig[]> {
    const entities = await this.tokenGatingConfigRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => tokenGatingConfigMapper.toDomain(entity));
  }

  async update(
    id: tokenGatingConfig['id'],
    payload: Partial<tokenGatingConfig>,
  ): Promise<tokenGatingConfig> {
    const entity = await this.tokenGatingConfigRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.tokenGatingConfigRepository.save(
      this.tokenGatingConfigRepository.create(
        tokenGatingConfigMapper.toPersistence({
          ...tokenGatingConfigMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return tokenGatingConfigMapper.toDomain(updatedEntity);
  }

  async remove(id: tokenGatingConfig['id']): Promise<void> {
    await this.tokenGatingConfigRepository.delete(id);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConversationEntity } from '../entities/conversation.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Conversation } from '../../../../domain/conversation';
import { ConversationRepository } from '../../conversation.repository';
import { ConversationMapper } from '../mappers/conversation.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ConversationRelationalRepository
  implements ConversationRepository
{
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationRepository: Repository<ConversationEntity>,
  ) {}

  async create(data: Conversation): Promise<Conversation> {
    const persistenceModel = ConversationMapper.toPersistence(data);
    const newEntity = await this.conversationRepository.save(
      this.conversationRepository.create(persistenceModel),
    );
    return ConversationMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
    withDeleted = false,
  }: {
    paginationOptions: IPaginationOptions;
    withDeleted?: boolean;
  }): Promise<Conversation[]> {
    const entities = await this.conversationRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: {
        createdAt: 'DESC',
      },
      withDeleted,
    });

    return entities.map((entity) => ConversationMapper.toDomain(entity));
  }

  async findById(
    id: Conversation['id'],
    withDeleted = false,
  ): Promise<NullableType<Conversation>> {
    const entity = await this.conversationRepository.findOne({
      where: { id },
      withDeleted,
    });

    return entity ? ConversationMapper.toDomain(entity) : null;
  }

  async findByIds(
    ids: Conversation['id'][],
    withDeleted = false,
  ): Promise<Conversation[]> {
    const entities = await this.conversationRepository.find({
      where: { id: In(ids) },
      withDeleted,
    });

    return entities.map((entity) => ConversationMapper.toDomain(entity));
  }

  async update(
    id: Conversation['id'],
    payload: Partial<Conversation>,
  ): Promise<Conversation> {
    const entity = await this.conversationRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.conversationRepository.save(
      this.conversationRepository.create(
        ConversationMapper.toPersistence({
          ...ConversationMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return ConversationMapper.toDomain(updatedEntity);
  }

  async remove(id: Conversation['id']): Promise<void> {
    await this.conversationRepository.softDelete(id);
  }

  async restore(id: Conversation['id']): Promise<void> {
    await this.conversationRepository.restore(id);
  }

  async hardDelete(id: Conversation['id']): Promise<void> {
    await this.conversationRepository.delete(id);
  }
}

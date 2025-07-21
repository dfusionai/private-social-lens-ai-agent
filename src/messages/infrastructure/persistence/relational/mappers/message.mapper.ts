import { Message } from '../../../../domain/message';

import { ConversationMapper } from '../../../../../conversations/infrastructure/persistence/relational/mappers/conversation.mapper';

import { MessageEntity } from '../entities/message.entity';

export class MessageMapper {
  static toDomain(raw: MessageEntity): Message {
    const domainEntity = new Message();
    domainEntity.content = raw.content || '';

    domainEntity.role = raw.role;

    if (raw.conversation) {
      domainEntity.conversation = ConversationMapper.toDomain(raw.conversation);
    }

    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Message): MessageEntity {
    const persistenceEntity = new MessageEntity();
    persistenceEntity.content = domainEntity.content;

    persistenceEntity.role = domainEntity.role;

    if (domainEntity.conversation) {
      persistenceEntity.conversation = ConversationMapper.toPersistence(
        domainEntity.conversation,
      );
    }

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}

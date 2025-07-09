import { ConversationsService } from '../conversations/conversations.service';
import { Conversation } from '../conversations/domain/conversation';

import {
  // common
  Injectable,
  HttpStatus,
  UnprocessableEntityException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessageRepository } from './infrastructure/persistence/message.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Message } from './domain/message';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationService: ConversationsService,

    // Dependencies here
    private readonly messageRepository: MessageRepository,
  ) {}

  async create(createMessageDto: CreateMessageDto) {
    // Do not remove comment below.
    // <creating-property />

    const conversationObject = await this.conversationService.findById(
      createMessageDto.conversation.id,
    );
    if (!conversationObject) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          conversation: 'notExists',
        },
      });
    }
    const conversation = conversationObject;

    return this.messageRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      content: createMessageDto.content,

      role: createMessageDto.role,

      conversation,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.messageRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Message['id']) {
    return this.messageRepository.findById(id);
  }

  findByIds(ids: Message['id'][]) {
    return this.messageRepository.findByIds(ids);
  }

  async update(
    id: Message['id'],

    updateMessageDto: UpdateMessageDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    let conversation: Conversation | undefined = undefined;

    if (updateMessageDto.conversation) {
      const conversationObject = await this.conversationService.findById(
        updateMessageDto.conversation.id,
      );
      if (!conversationObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            conversation: 'notExists',
          },
        });
      }
      conversation = conversationObject;
    }

    return this.messageRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      content: updateMessageDto.content,

      role: updateMessageDto.role,

      conversation,
    });
  }

  remove(id: Message['id']) {
    return this.messageRepository.remove(id);
  }
}

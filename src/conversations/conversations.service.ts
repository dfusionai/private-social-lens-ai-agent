import { UsersService } from '../users/users.service';
import { User } from '../users/domain/user';

import {
  // common
  Injectable,
  HttpStatus,
  UnprocessableEntityException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationRepository } from './infrastructure/persistence/conversation.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Conversation } from './domain/conversation';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly userService: UsersService,

    // Dependencies here
    private readonly conversationRepository: ConversationRepository,
  ) {}

  async create({
    userId,
    createConversationDto,
  }: {
    userId: User['id'];
    createConversationDto: CreateConversationDto;
  }) {
    // Do not remove comment below.
    // <creating-property />

    const userObject = await this.userService.findById(userId);
    if (!userObject) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'notExists',
        },
      });
    }
    const user = userObject;

    return this.conversationRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      title: createConversationDto.title,

      user,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.conversationRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Conversation['id']) {
    return this.conversationRepository.findById(id);
  }

  findByIds(ids: Conversation['id'][]) {
    return this.conversationRepository.findByIds(ids);
  }

  async update({
    id,
    userId,
    updateConversationDto,
  }: {
    id: Conversation['id'];
    userId: User['id'];
    updateConversationDto: UpdateConversationDto;
  }) {
    // Do not remove comment below.
    // <updating-property />

    const conversation = await this.findById(id);
    if (!conversation) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          conversation: 'notExists',
        },
      });
    }

    if (conversation.user.id !== userId) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: {
          conversation: 'notOwner',
        },
      });
    }

    return this.conversationRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      title: updateConversationDto.title,
    });
  }

  async remove({ id, userId }: { id: Conversation['id']; userId: User['id'] }) {
    const conversation = await this.findById(id);
    if (!conversation) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          conversation: 'notExists',
        },
      });
    }

    if (conversation.user.id !== userId) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: {
          conversation: 'notOwner',
        },
      });
    }

    return this.conversationRepository.remove(id);
  }
}

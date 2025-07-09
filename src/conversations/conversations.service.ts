import { UsersService } from '../users/users.service';
import { User } from '../users/domain/user';
import { MessagesService } from '../messages/messages.service';

import {
  // common
  Injectable,
  HttpStatus,
  UnprocessableEntityException,
  ForbiddenException,
  MessageEvent,
} from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ChatDto } from './dto/chat.dto';
import { ConversationRepository } from './infrastructure/persistence/conversation.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Conversation } from './domain/conversation';
import { Observable } from 'rxjs';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly userService: UsersService,
    private readonly messagesService: MessagesService,

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

  async chat({ userId, chatDto }: { userId: User['id']; chatDto: ChatDto }) {
    let conversation: Conversation;

    if (chatDto.conversationId) {
      // Check if conversation exists and user owns it
      const existingConversation = await this.findById(chatDto.conversationId);
      if (!existingConversation) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            conversation: 'notExists',
          },
        });
      }

      if (existingConversation.user.id !== userId) {
        throw new ForbiddenException({
          status: HttpStatus.FORBIDDEN,
          errors: {
            conversation: 'notOwner',
          },
        });
      }

      conversation = existingConversation;
    } else {
      // Create new conversation
      conversation = await this.create({
        userId,
        createConversationDto: {
          title: chatDto.title || 'New Chat',
        },
      });
    }

    // Save the user message
    const userMessage = await this.messagesService.create({
      content: chatDto.content,
      role: 'user',
      conversation: {
        id: conversation.id,
      },
    });

    return {
      conversation,
      userMessage,
    };
  }

  async chatStream({
    userId,
    chatDto,
  }: {
    userId: User['id'];
    chatDto: ChatDto;
  }): Promise<Observable<MessageEvent>> {
    // First, handle the conversation and save user message
    const { conversation, userMessage } = await this.chat({ userId, chatDto });

    return new Observable<MessageEvent>((observer) => {
      // Send initial event with conversation and user message
      observer.next({
        data: JSON.stringify({
          type: 'conversation',
          conversation,
          userMessage,
        }),
      } as MessageEvent);

      // Simulate streaming AI response (replace this with actual AI service)
      const aiResponse =
        'This is a simulated AI response. In a real implementation, you would integrate with an AI service like OpenAI, Claude, etc.';

      // Stream the response word by word
      const words = aiResponse.split(' ');
      let currentResponse = '';

      words.forEach((word, index) => {
        setTimeout(() => {
          currentResponse += (index > 0 ? ' ' : '') + word;

          observer.next({
            data: JSON.stringify({
              type: 'chunk',
              content: word,
              fullContent: currentResponse,
            }),
          } as MessageEvent);

          // If this is the last word, send completion event and save AI message
          if (index === words.length - 1) {
            setTimeout(async () => {
              // Save the AI message to database
              const aiMessage = await this.messagesService.create({
                content: aiResponse,
                role: 'assistant',
                conversation: {
                  id: conversation.id,
                },
              });

              observer.next({
                data: JSON.stringify({
                  type: 'complete',
                  aiMessage,
                }),
              } as MessageEvent);

              observer.complete();
            }, 100);
          }
        }, index * 100); // Delay each word by 100ms
      });
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

import { UsersService } from '../users/users.service';
import { User } from '../users/domain/user';
import { MessagesService } from '../messages/messages.service';
import { ModelApiFactoryService } from '../model-api/services/model-api-factory.service';
import { ModelProvider } from '../model-api/enums/model-provider.enum';
import { ChatMessage } from '../model-api/interfaces/model-api.interface';
import { MessageResponseDto } from '../messages/dto/message-response.dto';

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
    private readonly modelApiFactory: ModelApiFactoryService,

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
      // Validate conversation exists and user owns it
      conversation = await this.validateConversationOwnership({
        conversationId: chatDto.conversationId,
        userId,
      });
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

    // Get conversation history for context and generate AI response
    const messages = await this.getConversationHistory(conversation.id);
    const provider = chatDto.options?.provider || ModelProvider.CLAUDE;
    const modelService = this.modelApiFactory.getModelService(provider);

    try {
      const aiResponse = await modelService.chat(messages, {
        model: chatDto.options?.model,
        temperature: chatDto.options?.temperature,
        maxTokens: chatDto.options?.maxTokens,
      });

      // Save the AI message
      const aiMessage = await this.messagesService.create({
        content: aiResponse.content,
        role: 'assistant',
        conversation: {
          id: conversation.id,
        },
      });

      return {
        conversation,
        userMessage,
        aiMessage,
      };
    } catch (error) {
      // If AI fails, still return conversation and user message
      return {
        conversation,
        userMessage,
        error: error.message,
      };
    }
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

    // Get conversation history for context
    const messages = await this.getConversationHistory(conversation.id);

    // Get the model service
    const provider = chatDto.options?.provider || ModelProvider.GEMINI;
    const modelService = this.modelApiFactory.getModelService(provider);

    return new Observable<MessageEvent>((observer) => {
      // Send initial event with conversation and user message
      observer.next({
        data: JSON.stringify({
          type: 'conversation',
          conversation,
          userMessage,
        }),
      } as MessageEvent);

      let fullResponse = '';

      // Create stream from AI service
      const aiStream = modelService.chatStream(messages, {
        model: chatDto.options?.model,
        temperature: chatDto.options?.temperature,
        maxTokens: chatDto.options?.maxTokens,
      });

      aiStream.subscribe({
        next: (chunk) => {
          if (chunk.content) {
            fullResponse += chunk.content;

            observer.next({
              data: JSON.stringify({
                type: 'chunk',
                content: chunk.content,
                fullContent: fullResponse,
              }),
            } as MessageEvent);
          }

          if (chunk.done) {
            // Save the AI message to database
            this.messagesService
              .create({
                content: fullResponse,
                role: 'assistant',
                conversation: {
                  id: conversation.id,
                },
              })
              .then((aiMessage) => {
                observer.next({
                  data: JSON.stringify({
                    type: 'complete',
                    aiMessage,
                  }),
                } as MessageEvent);

                observer.complete();
              })
              .catch((error) => {
                observer.error(error);
              });
          }
        },
        error: (error) => {
          observer.error(error);
        },
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

  private async validateConversationOwnership({
    conversationId,
    userId,
  }: {
    conversationId: Conversation['id'];
    userId: User['id'];
  }): Promise<Conversation> {
    const conversation = await this.findById(conversationId);
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

    return conversation;
  }

  async findMessagesByConversationWithPagination({
    conversationId,
    userId,
    paginationOptions,
  }: {
    conversationId: Conversation['id'];
    userId: User['id'];
    paginationOptions: IPaginationOptions;
  }) {
    // Validate conversation exists and user owns it
    await this.validateConversationOwnership({ conversationId, userId });

    // Get messages for the conversation
    const messages =
      await this.messagesService.findByConversationWithPagination({
        conversationId,
        paginationOptions,
      });

    // Transform messages to response format
    return messages.map((message) => new MessageResponseDto(message));
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

    // Validate conversation exists and user owns it
    await this.validateConversationOwnership({
      conversationId: id,
      userId,
    });

    return this.conversationRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      title: updateConversationDto.title,
    });
  }

  async remove({ id, userId }: { id: Conversation['id']; userId: User['id'] }) {
    // Validate conversation exists and user owns it
    await this.validateConversationOwnership({
      conversationId: id,
      userId,
    });

    return this.conversationRepository.remove(id);
  }

  private async getConversationHistory(
    conversationId: Conversation['id'],
  ): Promise<ChatMessage[]> {
    // Get recent messages for context (limit to prevent token overflow)
    const messages =
      await this.messagesService.findByConversationWithPagination({
        conversationId,
        paginationOptions: { page: 1, limit: 20 },
      });

    // Convert to ChatMessage format and reverse order (oldest first)
    return messages.reverse().map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }));
  }
}

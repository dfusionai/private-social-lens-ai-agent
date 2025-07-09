import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
  Res,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ChatDto } from './dto/chat.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { FindConversationMessagesDto } from './dto/find-conversation-messages.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiOperation,
  ApiProduces,
} from '@nestjs/swagger';
import { Conversation } from './domain/conversation';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllConversationsDto } from './dto/find-all-conversations.dto';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Response } from 'express';
import { MessageResponseDto } from '../messages/dto/message-response.dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'conversations',
  version: '1',
})
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiCreatedResponse({
    type: Conversation,
  })
  create(
    @Request() request: { user: JwtPayloadType },
    @Body() createConversationDto: CreateConversationDto,
  ) {
    return this.conversationsService.create({
      userId: request.user.id,
      createConversationDto,
    });
  }

  @Post('chat/stream')
  @ApiOperation({
    summary: 'Chat with streaming response',
    description:
      'Send a message and receive a streaming AI response via Server-Sent Events. Creates a new conversation if conversationId is not provided.',
  })
  @ApiProduces('text/event-stream')
  @ApiCreatedResponse({
    description: 'Server-Sent Events stream with chat responses',
    schema: {
      type: 'string',
      example:
        'data: {"type": "chunk", "content": "Hello", "fullContent": "Hello"}\n\n',
    },
  })
  async chatStream(
    @Request() request: { user: JwtPayloadType },
    @Body() chatDto: ChatDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    const stream = await this.conversationsService.chatStream({
      userId: request.user.id,
      chatDto,
    });

    stream.subscribe({
      next: (event) => {
        res.write(`data: ${event.data}\n\n`);
      },
      complete: () => {
        res.end();
      },
      error: (error) => {
        res.write(
          `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`,
        );
        res.end();
      },
    });
  }

  @Post('chat')
  @ApiOperation({
    summary: 'Chat with regular response',
    description:
      'Send a message to a conversation or create a new one. Returns the conversation and user message.',
  })
  @ApiCreatedResponse({
    type: ChatResponseDto,
    description: 'Chat response with conversation and user message',
  })
  async chat(
    @Request() request: { user: JwtPayloadType },
    @Body() chatDto: ChatDto,
  ) {
    return this.conversationsService.chat({
      userId: request.user.id,
      chatDto,
    });
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Conversation),
  })
  async findAll(
    @Query() query: FindAllConversationsDto,
  ): Promise<InfinityPaginationResponseDto<Conversation>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.conversationsService.findAllWithPagination({
        paginationOptions: {
          page,
          limit,
        },
      }),
      { page, limit },
    );
  }

  @Get(':id/messages')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOperation({
    summary: 'Get messages for a conversation',
    description:
      'Retrieve paginated messages for a specific conversation. Messages are ordered newest first (DESC) to support chat UI pagination where older messages load at the top.',
  })
  @ApiOkResponse({
    type: InfinityPaginationResponse(MessageResponseDto),
  })
  async getConversationMessages(
    @Request() request: { user: JwtPayloadType },
    @Param('id') id: string,
    @Query() query: FindConversationMessagesDto,
  ): Promise<InfinityPaginationResponseDto<MessageResponseDto>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const messages =
      await this.conversationsService.findMessagesByConversationWithPagination({
        conversationId: id,
        userId: request.user.id,
        paginationOptions: {
          page,
          limit,
        },
      });

    return infinityPagination(messages, { page, limit });
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: Conversation,
  })
  findById(@Param('id') id: string) {
    return this.conversationsService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: Conversation,
  })
  async update(
    @Request() request: { user: JwtPayloadType },
    @Param('id') id: string,
    @Body() updateConversationDto: UpdateConversationDto,
  ) {
    return this.conversationsService.update({
      id,
      userId: request.user.id,
      updateConversationDto,
    });
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  async remove(
    @Request() request: { user: JwtPayloadType },
    @Param('id') id: string,
  ) {
    return this.conversationsService.remove({
      id,
      userId: request.user.id,
    });
  }
}

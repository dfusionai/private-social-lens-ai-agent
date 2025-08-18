import { ApiProperty } from '@nestjs/swagger';
import { Conversation } from '../domain/conversation';
import { Message } from '../../messages/domain/message';

export class ChatResponseDto {
  @ApiProperty()
  conversation: Conversation;

  @ApiProperty()
  userMessage: Message;
}

export class ChatStreamEventDto {
  @ApiProperty({
    enum: ['conversation', 'chunk', 'complete'],
    description: 'Type of the stream event',
  })
  type: 'conversation' | 'chunk' | 'complete';

  @ApiProperty({
    required: false,
    description: 'Available when type is conversation',
  })
  conversation?: Conversation;

  @ApiProperty({
    required: false,
    description: 'Available when type is conversation',
  })
  userMessage?: Message;

  @ApiProperty({
    required: false,
    description: 'Available when type is chunk',
  })
  content?: string;

  @ApiProperty({
    required: false,
    description: 'Available when type is chunk',
  })
  fullContent?: string;

  @ApiProperty({
    required: false,
    description: 'Available when type is complete',
  })
  aiMessage?: Message;
}

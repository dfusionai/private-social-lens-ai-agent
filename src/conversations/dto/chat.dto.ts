import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class ChatDto {
  @ApiProperty({
    description: 'The message content to send',
    example: 'Hello, how can you help me today?',
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description:
      'The conversation ID (optional - will create new if not provided)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'The title for a new conversation (optional)',
    example: 'General Discussion',
  })
  @IsOptional()
  @IsString()
  title?: string;
}

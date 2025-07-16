import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MessagePlatform {
  TELEGRAM = 'telegram',
  WHATSAPP = 'whatsapp',
  DISCORD = 'discord',
  SLACK = 'slack',
  MESSENGER = 'messenger',
  OTHER = 'other',
}

export class ImportMessageDto {
  @ApiProperty({ example: 'Hello, how are you?' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  senderName: string;

  @ApiProperty({ example: '@johndoe', required: false })
  @IsOptional()
  @IsString()
  senderUsername?: string;

  @ApiProperty({ example: '123456789', required: false })
  @IsOptional()
  @IsString()
  senderId?: string;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  @IsDateString()
  timestamp: string;

  @ApiProperty({
    enum: MessagePlatform,
    example: MessagePlatform.TELEGRAM,
  })
  @IsEnum(MessagePlatform)
  platform: MessagePlatform;

  @ApiProperty({ example: 'General Chat', required: false })
  @IsOptional()
  @IsString()
  chatName?: string;

  @ApiProperty({ example: 'group', required: false })
  @IsOptional()
  @IsString()
  chatType?: string;

  @ApiProperty({ example: 'msg_123', required: false })
  @IsOptional()
  @IsString()
  originalMessageId?: string;

  @ApiProperty({
    required: false,
    description: 'Additional platform-specific metadata',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ImportMessagesDto {
  @ApiProperty({
    type: [ImportMessageDto],
    description: 'Array of messages to import',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportMessageDto)
  messages: ImportMessageDto[];

  @ApiProperty({
    example: 'telegram_export_2024',
    required: false,
    description: 'Batch identifier for this import',
  })
  @IsOptional()
  @IsString()
  batchId?: string;
}

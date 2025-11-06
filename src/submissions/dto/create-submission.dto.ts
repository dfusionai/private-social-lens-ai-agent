import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ChatMessageDto {
  // Message content as JSON object - using index signature
  [key: string]: any;
}

export class ChatDto {
  @ApiProperty({ description: 'Chat ID', example: 7819943789 })
  @IsNotEmpty()
  chat_id: number;

  @ApiProperty({
    description: 'Array of messages which are JSON objects',
    type: [ChatMessageDto],
  })
  @IsArray()
  @Transform(({ value }) => {
    // Preserve raw data - don't let class-transformer strip properties
    // Return the value as-is to maintain all message properties
    return value;
  })
  contents: ChatMessageDto[];
}

export class CreateSubmissionDto {
  @ApiProperty({ description: 'Revision version', example: '01.01' })
  @IsString()
  @IsNotEmpty()
  revision: string;

  @ApiProperty({ description: 'Source identifier', example: 'telegramMiner' })
  @IsString()
  @IsNotEmpty()
  source: string;

  @ApiProperty({ description: 'User identifier', example: '5619346142' })
  @IsString()
  @IsNotEmpty()
  user: string;

  @ApiProperty({ description: 'Submission token', example: 'token' })
  @IsString()
  @IsNotEmpty()
  submission_token: string;

  @ApiProperty({
    description: 'Array of chats',
    type: [ChatDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatDto)
  chats: ChatDto[];
}

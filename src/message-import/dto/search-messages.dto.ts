import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsPositive,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MessagePlatform } from './import-message.dto';

export class SearchMessagesDto {
  @ApiProperty({ example: 'meeting tomorrow' })
  @IsString()
  query: string;

  @ApiProperty({ example: 10, minimum: 1, maximum: 100, required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({ example: 0.5, minimum: 0, maximum: 1, required: false })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number = 0.5;

  @ApiProperty({
    enum: MessagePlatform,
    required: false,
    description: 'Filter by platform',
  })
  @IsOptional()
  @IsEnum(MessagePlatform)
  platform?: MessagePlatform;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiProperty({ example: 'General Chat', required: false })
  @IsOptional()
  @IsString()
  chatName?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
    required: false,
    description: 'Filter messages from this date',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({
    example: '2024-12-31T23:59:59Z',
    required: false,
    description: 'Filter messages until this date',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsPositive,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchDocumentsDto {
  @ApiProperty({ example: 'search query' })
  @IsString()
  query: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 50, required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(50)
  limit?: number = 5;

  @ApiProperty({ example: 0.5, minimum: 0, maximum: 1, required: false })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number = 0.5;

  @ApiProperty({ example: 'conv-123', required: false })
  @IsOptional()
  @IsString()
  conversationId?: string;
}

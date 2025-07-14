import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ModelProvider } from '../enums/model-provider.enum';

export class ChatRequestOptionsDto {
  @ApiPropertyOptional({
    enum: ModelProvider,
    description: 'AI provider to use',
    example: ModelProvider.CLAUDE,
  })
  @IsOptional()
  @IsEnum(ModelProvider)
  provider?: ModelProvider;

  @ApiPropertyOptional({
    description: 'Model to use for the provider',
    example: 'claude-3-5-sonnet-20241022',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Temperature for response randomness',
    minimum: 0,
    maximum: 2,
    example: 0.7,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Maximum tokens in response',
    minimum: 1,
    maximum: 8000,
    example: 4000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8000)
  maxTokens?: number;
}

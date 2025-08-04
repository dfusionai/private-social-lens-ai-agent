import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { JobType } from '../enums/job-type.enum';

export class CreateJobDto {
  @ApiProperty({
    description: 'Blob ID from Walrus storage',
    example: 'blob_123456789',
  })
  @IsNotEmpty()
  @IsString()
  blobId: string;

  @ApiProperty({
    description: 'On-chain file ID reference',
    example: 'onchain_file_987654321',
  })
  @IsNotEmpty()
  @IsString()
  onchainFileId: string;

  @ApiProperty({
    description: 'Policy ID for file access control',
    example: 'policy_abcdef123',
  })
  @IsNotEmpty()
  @IsString()
  policyId: string;

  @ApiProperty({
    enum: JobType,
    description: 'Type of job processing to perform',
    example: JobType.REFINEMENT,
  })
  @IsNotEmpty()
  @IsEnum(JobType)
  jobType: JobType;

  @ApiPropertyOptional({
    description: 'Job priority (1-10, higher is more priority)',
    minimum: 1,
    maximum: 10,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Additional processing metadata',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

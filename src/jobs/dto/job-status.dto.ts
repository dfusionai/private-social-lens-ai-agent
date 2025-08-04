import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { JobStatus } from '../enums/job-status.enum';

export class JobStatusDto {
  @ApiProperty({
    description: 'Job unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    enum: JobStatus,
    description: 'Current job status',
    example: JobStatus.PROCESSING,
  })
  @Expose()
  status: JobStatus;

  @ApiPropertyOptional({
    description: 'Job completion progress (0-100)',
    minimum: 0,
    maximum: 100,
    example: 75,
  })
  @Expose()
  progress?: number;

  @ApiPropertyOptional({
    description: 'Job processing result',
  })
  @Expose()
  result?: any;

  @ApiPropertyOptional({
    description: 'Error message if job failed',
    example: 'TEE processing timeout',
  })
  @Expose()
  error?: string;

  @ApiProperty({
    description: 'Job creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Expose()
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Job start timestamp',
    example: '2024-01-01T00:01:00.000Z',
  })
  @Expose()
  startedAt?: Date;

  @ApiPropertyOptional({
    description: 'Job completion timestamp',
    example: '2024-01-01T00:05:00.000Z',
  })
  @Expose()
  completedAt?: Date;

  @ApiPropertyOptional({
    description: 'Estimated completion time',
    example: '2024-01-01T00:03:00.000Z',
  })
  @Expose()
  estimatedCompletion?: Date;

  @ApiPropertyOptional({
    description: 'Whether the job can be cancelled',
    example: true,
  })
  @Expose()
  canCancel?: boolean;
}

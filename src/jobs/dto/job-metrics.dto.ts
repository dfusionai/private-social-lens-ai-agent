import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class QueueHealthDto {
  @ApiProperty({
    description: 'Number of pending jobs in queue',
    example: 25,
  })
  @Expose()
  queueSize: number;

  @ApiProperty({
    description: 'Number of jobs currently processing',
    example: 5,
  })
  @Expose()
  processing: number;

  @ApiProperty({
    description: 'Average processing time in milliseconds',
    example: 180000,
  })
  @Expose()
  averageProcessingTime: number;

  @ApiProperty({
    description: 'Estimated wait time for new jobs in milliseconds',
    example: 300000,
  })
  @Expose()
  estimatedWaitTime: number;

  @ApiProperty({
    description: 'Whether the queue is healthy',
    example: true,
  })
  @Expose()
  isHealthy: boolean;

  @ApiProperty({
    description: 'Last health check timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Expose()
  lastUpdated: Date;
}

import { ApiProperty } from '@nestjs/swagger';

export class LatestCompletedJobDto {
  @ApiProperty({
    description:
      'ISO timestamp of the latest completed job, null if no completed jobs exist',
    type: 'string',
    format: 'date-time',
    nullable: true,
    example: '2024-01-15T10:30:00.000Z',
  })
  latestCompletedAt: string | null;
}

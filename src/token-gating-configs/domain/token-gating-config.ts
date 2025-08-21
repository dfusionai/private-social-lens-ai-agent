import { ApiProperty } from '@nestjs/swagger';

export class tokenGatingConfig {
  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty()
  stakeThreshold: number;

  @ApiProperty()
  balanceThreshold: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

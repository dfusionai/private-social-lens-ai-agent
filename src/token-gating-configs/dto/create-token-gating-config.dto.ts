import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty } from 'class-validator';

export class CreateTokenGatingConfigDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  stakeThreshold: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  balanceThreshold: number;
}

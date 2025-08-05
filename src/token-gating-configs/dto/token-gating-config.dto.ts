import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class tokenGatingConfigDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;
}

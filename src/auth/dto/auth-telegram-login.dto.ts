import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AuthTelegramLoginDto {
  @ApiProperty({
    example: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz',
    description: 'Telegram session string',
  })
  @IsString()
  @IsNotEmpty()
  sessionString: string;

  @ApiProperty({
    example: '123456789',
    description: 'Telegram user ID',
  })
  @IsString()
  @IsNotEmpty()
  telegramId: number;
}

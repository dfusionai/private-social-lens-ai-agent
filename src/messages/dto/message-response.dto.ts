import { ApiProperty } from '@nestjs/swagger';
import { Message } from '../domain/message';

export class MessageResponseDto {
  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  id: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  content: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  role: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(message: Message) {
    this.id = message.id;
    this.content = message.content;
    this.role = message.role;
    this.createdAt = message.createdAt;
    this.updatedAt = message.updatedAt;
  }
}

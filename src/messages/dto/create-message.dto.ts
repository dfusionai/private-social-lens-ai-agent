import { ConversationDto } from '../../conversations/dto/conversation.dto';

import {
  // decorators here
  Type,
} from 'class-transformer';

import {
  // decorators here

  ValidateNested,
  IsNotEmptyObject,
  IsString,
} from 'class-validator';

import {
  // decorators here
  ApiProperty,
} from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  content: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  role: string;

  @ApiProperty({
    required: true,
    type: () => ConversationDto,
  })
  @ValidateNested()
  @Type(() => ConversationDto)
  @IsNotEmptyObject()
  conversation: ConversationDto;

  // Don't forget to use the class-validator decorators in the DTO properties.
}

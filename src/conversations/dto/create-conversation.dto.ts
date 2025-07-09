import {
  // decorators here
  IsString,
  IsOptional,
} from 'class-validator';

import {
  // decorators here
  ApiProperty,
} from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  title?: string | null;

  // Don't forget to use the class-validator decorators in the DTO properties.
}

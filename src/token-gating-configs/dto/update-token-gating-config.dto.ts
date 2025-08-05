// Don't forget to use the class-validator decorators in the DTO properties.
// import { Allow } from 'class-validator';

import { PartialType } from '@nestjs/swagger';
import { CreateTokenGatingConfigDto } from './create-token-gating-config.dto';

export class UpdateTokenGatingConfigDto extends PartialType(
  CreateTokenGatingConfigDto,
) {}

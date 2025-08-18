import { User } from '../../users/domain/user';
import { ApiProperty } from '@nestjs/swagger';

export class Conversation {
  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  title?: string | null;

  @ApiProperty({
    type: () => User,
    nullable: false,
  })
  user: User;

  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

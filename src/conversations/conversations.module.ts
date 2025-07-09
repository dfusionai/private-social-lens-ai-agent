import { UsersModule } from '../users/users.module';
import {
  // do not remove this comment
  Module,
  Global,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { RelationalConversationPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Global()
@Module({
  imports: [
    UsersModule,

    // do not remove this comment
    RelationalConversationPersistenceModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService, RelationalConversationPersistenceModule],
})
export class ConversationsModule {}

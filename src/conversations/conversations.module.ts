import { UsersModule } from '../users/users.module';
import { ModelApiModule } from '../model-api/model-api.module';
import { RagModule } from '../rag/rag.module';
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
    ModelApiModule,
    RagModule,

    // do not remove this comment
    RelationalConversationPersistenceModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService, RelationalConversationPersistenceModule],
})
export class ConversationsModule {}

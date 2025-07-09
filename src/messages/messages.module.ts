import {
  // do not remove this comment
  Module,
  Global,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
// import { MessagesController } from './messages.controller';
import { RelationalMessagePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Global()
@Module({
  imports: [
    // do not remove this comment
    RelationalMessagePersistenceModule,
  ],
  // controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService, RelationalMessagePersistenceModule],
})
export class MessagesModule {}

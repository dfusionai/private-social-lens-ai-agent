import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { tokenGatingConfigsService } from './token-gating-configs.service';
import { tokenGatingConfigsController } from './token-gating-configs.controller';
import { RelationaltokenGatingConfigPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [
    // do not remove this comment
    RelationaltokenGatingConfigPersistenceModule,
  ],
  controllers: [tokenGatingConfigsController],
  providers: [tokenGatingConfigsService],
  exports: [
    tokenGatingConfigsService,
    RelationaltokenGatingConfigPersistenceModule,
  ],
})
export class tokenGatingConfigsModule {}

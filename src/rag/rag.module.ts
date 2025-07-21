import { Module, forwardRef } from '@nestjs/common';
import { VectorDbModule } from '../vector-db/vector-db.module';
import { SecureMessageModule } from '../secure-message/secure-message.module';
import { RagService } from './rag.service';

@Module({
  imports: [VectorDbModule, forwardRef(() => SecureMessageModule)],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}

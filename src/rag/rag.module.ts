import { Module } from '@nestjs/common';
import { VectorDbModule } from '../vector-db/vector-db.module';
import { RagService } from './rag.service';

@Module({
  imports: [VectorDbModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}

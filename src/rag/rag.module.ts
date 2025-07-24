import { Module } from '@nestjs/common';
import { VectorDbModule } from '../vector-db/vector-db.module';
import { NautilusModule } from '../nautilus/nautilus.module';
import { RagService } from './rag.service';

@Module({
  imports: [VectorDbModule, NautilusModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}

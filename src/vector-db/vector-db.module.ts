import { Module } from '@nestjs/common';
import { VectorDbFactory } from './vector-db-factory.service';
import { VectorDbService } from './vector-db.service';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  imports: [EmbeddingsModule],
  providers: [VectorDbFactory, VectorDbService],
  exports: [VectorDbService],
})
export class VectorDbModule {}

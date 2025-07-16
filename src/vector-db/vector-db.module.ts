import { Module } from '@nestjs/common';
import { VectorDbFactory } from './vector-db-factory.service';
import { VectorDbService } from './vector-db.service';

@Module({
  providers: [VectorDbFactory, VectorDbService],
  exports: [VectorDbService],
})
export class VectorDbModule {}

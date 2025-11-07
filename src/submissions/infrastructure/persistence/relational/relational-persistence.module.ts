import { Module } from '@nestjs/common';
import { SubmissionRepository } from '../submission.repository';
import { SubmissionRelationalRepository } from './repositories/submission.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionEntity } from './entities/submission.entity';
import { BatchRepository } from '../batch.repository';
import { BatchRelationalRepository } from './repositories/batch.repository';
import { BatchEntity } from './entities/batch.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubmissionEntity, BatchEntity]),
  ],
  providers: [
    {
      provide: SubmissionRepository,
      useClass: SubmissionRelationalRepository,
    },
    {
      provide: BatchRepository,
      useClass: BatchRelationalRepository,
    },
  ],
  exports: [SubmissionRepository, BatchRepository],
})
export class RelationalSubmissionPersistenceModule {}

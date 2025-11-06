import { Module } from '@nestjs/common';
import { SubmissionRepository } from '../submission.repository';
import { SubmissionRelationalRepository } from './repositories/submission.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionEntity } from './entities/submission.entity';
import { UserBatchTrackingRepository } from '../user-batch-tracking.repository';
import { UserBatchTrackingRelationalRepository } from './repositories/user-batch-tracking.repository';
import { UserBatchTrackingEntity } from './entities/user-batch-tracking.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubmissionEntity, UserBatchTrackingEntity]),
  ],
  providers: [
    {
      provide: SubmissionRepository,
      useClass: SubmissionRelationalRepository,
    },
    {
      provide: UserBatchTrackingRepository,
      useClass: UserBatchTrackingRelationalRepository,
    },
  ],
  exports: [SubmissionRepository, UserBatchTrackingRepository],
})
export class RelationalSubmissionPersistenceModule {}

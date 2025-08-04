import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsController } from './jobs.controller';
import { RelationalJobPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { PgBossQueueService } from './services/pg-boss-queue.service';
import { JobProducerService } from './services/job-producer.service';
import { JobConsumerService } from './services/job-consumer.service';
import { JobMonitoringService } from './services/job-monitoring.service';
import { NautilusModule } from '../nautilus/nautilus.module';
import { UsersModule } from '../users/users.module';
import jobConfig from './config/job.config';

@Module({
  imports: [
    ConfigModule.forFeature(jobConfig),
    ScheduleModule.forRoot(),
    RelationalJobPersistenceModule,
    NautilusModule,
    UsersModule,
  ],
  controllers: [JobsController],
  providers: [
    PgBossQueueService,
    JobProducerService,
    JobConsumerService,
    JobMonitoringService,
  ],
  exports: [JobProducerService, JobMonitoringService, PgBossQueueService],
})
export class JobsModule {}

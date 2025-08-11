import { Module } from '@nestjs/common';
import { JobRepository } from '../job.repository';
import { JobRelationalRepository } from './repositories/job.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobEntity } from './entities/job.entity';

@Module({
  imports: [TypeOrmModule.forFeature([JobEntity])],
  providers: [
    {
      provide: JobRepository,
      useClass: JobRelationalRepository,
    },
  ],
  exports: [JobRepository],
})
export class RelationalJobPersistenceModule {}

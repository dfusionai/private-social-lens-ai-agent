import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { SubmissionsController } from './submissions.controller';
import { RelationalSubmissionPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { SubmissionService } from './services/submission.service';
import { AzureBlobStorageService } from './services/azure-blob-storage.service';
import { BatchDownloadService } from './services/batch-download.service';
import { JobsModule } from '../jobs/jobs.module';
import submissionConfig from './config/submission.config';

@Module({
  imports: [
    ConfigModule.forFeature(submissionConfig),
    HttpModule,
    RelationalSubmissionPersistenceModule,
    forwardRef(() => JobsModule),
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionService, AzureBlobStorageService, BatchDownloadService],
  exports: [SubmissionService, AzureBlobStorageService, BatchDownloadService],
})
export class SubmissionsModule {}

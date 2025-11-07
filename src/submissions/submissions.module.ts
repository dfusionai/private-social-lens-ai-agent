import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { SubmissionsController } from './submissions.controller';
import { RelationalSubmissionPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { SubmissionService } from './services/submission.service';
import { AzureBlobStorageService } from './services/azure-blob-storage.service';
import { BatchDownloadService } from './services/batch-download.service';
import { WalrusQuiltService } from './services/walrus-quilt.service';
import { JobsModule } from '../jobs/jobs.module';
import { UsersModule } from '../users/users.module';
import { IdMaskerService } from '../utils/id-masker.service';
import submissionConfig from './config/submission.config';

@Module({
  imports: [
    ConfigModule.forFeature(submissionConfig),
    HttpModule,
    JwtModule.register({}),
    RelationalSubmissionPersistenceModule,
    forwardRef(() => JobsModule),
    UsersModule,
  ],
  controllers: [SubmissionsController],
  providers: [
    SubmissionService,
    AzureBlobStorageService,
    BatchDownloadService,
    WalrusQuiltService,
    IdMaskerService,
  ],
  exports: [
    SubmissionService,
    AzureBlobStorageService,
    BatchDownloadService,
    WalrusQuiltService,
  ],
})
export class SubmissionsModule {}

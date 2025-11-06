import { registerAs } from '@nestjs/config';
import validateConfig from '../../utils/validate-config';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { SubmissionConfig } from './submission-config.type';

class EnvironmentVariablesValidator {
  @IsString()
  AZURE_STORAGE_ACCOUNT_NAME: string;

  @IsString()
  AZURE_STORAGE_ACCOUNT_KEY: string;

  @IsString()
  AZURE_STORAGE_CONTAINER_NAME: string;

  @IsNumber()
  @Min(1)
  BATCH_CHAT_THRESHOLD: number;

  @IsNumber()
  @Min(1)
  BATCH_CHAT_MAX_THRESHOLD: number;

  @IsOptional()
  @IsString()
  BATCH_DOWNLOAD_SERVICE_URL?: string;
}

export default registerAs<SubmissionConfig>('submission', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    azureStorageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || '',
    azureStorageAccountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY || '',
    azureStorageContainerName:
      process.env.AZURE_STORAGE_CONTAINER_NAME || 'submissions',
    batchChatThreshold: parseInt(process.env.BATCH_CHAT_THRESHOLD || '500', 10),
    batchChatMaxThreshold: parseInt(
      process.env.BATCH_CHAT_MAX_THRESHOLD || '600',
      10,
    ),
    batchDownloadServiceUrl: process.env.BATCH_DOWNLOAD_SERVICE_URL,
  };
});

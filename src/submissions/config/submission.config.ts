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
  WALRUS_PUBLISHER_URL?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  WALRUS_QUILT_EPOCHS?: number;
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
    walrusPublisherUrl: process.env.WALRUS_PUBLISHER_URL,
    walrusQuiltEpochs: process.env.WALRUS_QUILT_EPOCHS
      ? parseInt(process.env.WALRUS_QUILT_EPOCHS, 10)
      : 1,
  };
});

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

  @IsString()
  WALRUS_PUBLISHER_URL: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  WALRUS_QUILT_EPOCHS?: number;

  @IsOptional()
  @IsString()
  WALRUS_PUBLISHER_JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  WALRUS_PUBLISHER_JWT_ALGORITHM?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  WALRUS_PUBLISHER_JWT_EXPIRING_SEC?: number;

  @IsString()
  POLICY_OBJECT_ID: string;

  @IsOptional()
  @IsString()
  VANA_BLOCKCHAIN_RPC_URL?: string;

  @IsOptional()
  @IsString()
  VFSN_TOKEN_CONTRACT_ADDRESS?: string;

  @IsOptional()
  @IsString()
  STAKING_CONTRACT_ADDRESS?: string;

  @IsOptional()
  @IsString()
  MOVE_PACKAGE_ID?: string;

  @IsOptional()
  @IsString()
  SEAL_KEY_SERVERS?: string; // Comma-separated list

  @IsOptional()
  @IsNumber()
  @Min(1)
  SEAL_ENCRYPTION_THRESHOLD?: number;

  @IsOptional()
  @IsString()
  SEAL_RUBY_NODES_API_KEY?: string;

  @IsOptional()
  @IsString()
  SUI_NETWORK?: string;

  @IsOptional()
  @IsString()
  SUI_SECRET_KEY?: string;

  @IsOptional()
  SUBMISSION_CREATE_ENABLED?: string;
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
    walrusPublisherUrl: process.env.WALRUS_PUBLISHER_URL || '',
    walrusQuiltEpochs: process.env.WALRUS_QUILT_EPOCHS
      ? parseInt(process.env.WALRUS_QUILT_EPOCHS, 10)
      : 1,
    walrusPublisherJwtSecret: process.env.WALRUS_PUBLISHER_JWT_SECRET,
    walrusPublisherJwtAlgorithm: process.env.WALRUS_PUBLISHER_JWT_ALGORITHM,
    walrusPublisherJwtExpiringSec: process.env.WALRUS_PUBLISHER_JWT_EXPIRING_SEC
      ? parseInt(process.env.WALRUS_PUBLISHER_JWT_EXPIRING_SEC, 10)
      : 300, // Default 5 minutes
    policyObjectId: process.env.POLICY_OBJECT_ID || '',
    blockchainRpcUrl: process.env.VANA_BLOCKCHAIN_RPC_URL,
    tokenContractAddress: process.env.VFSN_TOKEN_CONTRACT_ADDRESS,
    stakingContractAddress: process.env.STAKING_CONTRACT_ADDRESS,
    // Seal encryption configuration
    movePackageId: process.env.MOVE_PACKAGE_ID,
    sealKeyServers: process.env.SEAL_KEY_SERVERS
      ? process.env.SEAL_KEY_SERVERS.split(',').map((s) => s.trim())
      : undefined,
    sealEncryptionThreshold: process.env.SEAL_ENCRYPTION_THRESHOLD
      ? parseInt(process.env.SEAL_ENCRYPTION_THRESHOLD, 10)
      : 1,
    sealRubyNodesApiKey: process.env.SEAL_RUBY_NODES_API_KEY,
    suiNetwork:
      (process.env.SUI_NETWORK as
        | 'mainnet'
        | 'testnet'
        | 'devnet'
        | 'localnet'
        | undefined) || 'mainnet',
    suiSecretKey: process.env.SUI_SECRET_KEY,
    createSubmissionEnabled: process.env.SUBMISSION_CREATE_ENABLED
      ? process.env.SUBMISSION_CREATE_ENABLED.toLowerCase() === 'true'
      : true, // Default to enabled
  };
});

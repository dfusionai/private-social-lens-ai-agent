import { registerAs } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import { AzureOpenAiConfig } from './azure-openai-config.type';
import validateConfig from '../../utils/validate-config';

class EnvironmentVariablesValidator {
  @IsOptional()
  @IsString()
  AZURE_OPENAI_ENDPOINT?: string;
  @IsOptional()
  @IsString()
  AZURE_OPENAI_API_KEY?: string;
  @IsOptional()
  @IsString()
  OPENAI_API_VERSION?: string;
  @IsOptional()
  @IsString()
  AZURE_OPENAI_DEPLOYMENT_NAME?: string;
}

export default registerAs<AzureOpenAiConfig>('azureopenai', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.OPENAI_API_VERSION || '2024-04-01-preview',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o-mini',
  };
});

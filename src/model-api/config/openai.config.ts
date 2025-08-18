import { registerAs } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import { OpenAiConfig } from './openai-config.type';
import validateConfig from '../../utils/validate-config';

class EnvironmentVariablesValidator {
  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;
}

export default registerAs<OpenAiConfig>('openai', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    apiKey: process.env.OPENAI_API_KEY,
  };
});

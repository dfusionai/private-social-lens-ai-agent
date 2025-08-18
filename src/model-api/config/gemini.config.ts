import { registerAs } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import { GeminiConfig } from './gemini-config.type';
import validateConfig from '../../utils/validate-config';

class EnvironmentVariablesValidator {
  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;
}

export default registerAs<GeminiConfig>('gemini', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    apiKey: process.env.GEMINI_API_KEY,
  };
});

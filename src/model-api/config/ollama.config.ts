import { registerAs } from '@nestjs/config';
import { IsOptional, IsString, IsUrl } from 'class-validator';
import { OllamaConfig } from './ollama-config.type';
import validateConfig from '../../utils/validate-config';

class EnvironmentVariablesValidator {
  @IsOptional()
  @IsUrl({ require_tld: false })
  OLLAMA_URL?: string;

  @IsOptional()
  @IsString()
  OLLAMA_DEFAULT_MODEL?: string;
}

export default registerAs<OllamaConfig>('ollama', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.2',
  };
});

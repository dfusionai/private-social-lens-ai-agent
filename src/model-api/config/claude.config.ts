import { registerAs } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import { ClaudeConfig } from './claude-config.type';
import validateConfig from '../../utils/validate-config';

class EnvironmentVariablesValidator {
  @IsOptional()
  @IsString()
  CLAUDE_API_KEY?: string;
}

export default registerAs<ClaudeConfig>('claude', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    apiKey: process.env.CLAUDE_API_KEY,
  };
});

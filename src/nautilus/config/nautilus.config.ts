import { registerAs } from '@nestjs/config';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { NautilusConfig } from './nautilus-config.type';
import validateConfig from '../../utils/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  NAUTILUS_URL: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  NAUTILUS_DEFAULT_TIMEOUT: number;

  @IsString()
  @IsOptional()
  NAUTILUS_DEFAULT_THRESHOLD: string;
}

export default registerAs<NautilusConfig>('nautilus', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    url: process.env.NAUTILUS_URL || 'http://localhost:3001',
    defaultTimeout: parseInt(process.env.NAUTILUS_DEFAULT_TIMEOUT ?? '120', 10),
    defaultThreshold: process.env.NAUTILUS_DEFAULT_THRESHOLD || '2',
  };
});

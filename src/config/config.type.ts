import { AppConfig } from './app-config.type';
import { AuthConfig } from '../auth/config/auth-config.type';
import { DatabaseConfig } from '../database/config/database-config.type';
import { FileConfig } from '../files/config/file-config.type';
import { MailConfig } from '../mail/config/mail-config.type';
import { OpenAiConfig } from '../model-api/config/openai-config.type';
import { ClaudeConfig } from '../model-api/config/claude-config.type';
import { GeminiConfig } from '../model-api/config/gemini-config.type';
import { EmbeddingConfig } from '../embeddings/config/embedding-config.type';

export type AllConfigType = {
  app: AppConfig;
  auth: AuthConfig;
  database: DatabaseConfig;
  file: FileConfig;
  mail: MailConfig;
  openai: OpenAiConfig;
  claude: ClaudeConfig;
  gemini: GeminiConfig;
  embedding: EmbeddingConfig;
};

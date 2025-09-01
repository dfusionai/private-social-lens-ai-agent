import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AzureOpenAiService } from './services/azure-openai.service';
import { OpenAiService } from './services/openai.service';
import { ClaudeService } from './services/claude.service';
import { GeminiService } from './services/gemini.service';
import { OllamaService } from './services/ollama.service';
import { ModelApiFactoryService } from './services/model-api-factory.service';
import azureOpenaiConfig from './config/azure-openai.config';
import openaiConfig from './config/openai.config';
import claudeConfig from './config/claude.config';
import geminiConfig from './config/gemini.config';
import ollamaConfig from './config/ollama.config';

@Module({
  imports: [
    ConfigModule.forFeature(azureOpenaiConfig),
    ConfigModule.forFeature(openaiConfig),
    ConfigModule.forFeature(claudeConfig),
    ConfigModule.forFeature(geminiConfig),
    ConfigModule.forFeature(ollamaConfig),
  ],
  providers: [
    AzureOpenAiService,
    OpenAiService,
    ClaudeService,
    GeminiService,
    OllamaService,
    ModelApiFactoryService,
  ],
  exports: [ModelApiFactoryService],
})
export class ModelApiModule {}

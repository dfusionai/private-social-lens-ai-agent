import { Injectable, BadRequestException } from '@nestjs/common';
import { ModelApiService } from '../interfaces/model-api.interface';
import { OpenAiService } from './openai.service';
import { ClaudeService } from './claude.service';
import { GeminiService } from './gemini.service';
import { OllamaService } from './ollama.service';
import { ModelProvider } from '../enums/model-provider.enum';
import { AzureOpenAiService } from './azure-openai.service';

@Injectable()
export class ModelApiFactoryService {
  constructor(
    private readonly azureOpenAiService: AzureOpenAiService,
    private readonly openAiService: OpenAiService,
    private readonly claudeService: ClaudeService,
    private readonly geminiService: GeminiService,
    private readonly ollamaService: OllamaService,
  ) {}

  getModelService(provider: ModelProvider): ModelApiService {
    switch (provider) {
      case ModelProvider.AZUREOPENAI:
        return this.azureOpenAiService;
      case ModelProvider.OPENAI:
        return this.openAiService;
      case ModelProvider.CLAUDE:
        return this.claudeService;
      case ModelProvider.GEMINI:
        return this.geminiService;
      case ModelProvider.OLLAMA:
        return this.ollamaService;
      default:
        throw new BadRequestException(
          `Unsupported model provider: ${provider}`,
        );
    }
  }

  getAvailableProviders(): ModelProvider[] {
    return Object.values(ModelProvider);
  }
}

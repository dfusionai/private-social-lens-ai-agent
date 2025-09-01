import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AzureOpenAI } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/index';
import { Observable } from 'rxjs';
import { AllConfigType } from '../../config/config.type';
import {
  ChatMessage,
  ModelApiOptions,
  ModelApiService,
  ModelResponse,
  StreamChunk,
} from '../interfaces/model-api.interface';

@Injectable()
export class AzureOpenAiService extends ModelApiService {
  private azureOpenAI: AzureOpenAI;
  private defaultModel = 'gpt-4o-mini';

  constructor(private configService: ConfigService<AllConfigType>) {
    super();
    this.azureOpenAI = new AzureOpenAI({
      endpoint: this.configService.get('azureopenai.endpoint', { infer: true }),
      apiKey: this.configService.get('azureopenai.apiKey', { infer: true }),
      apiVersion:
        this.configService.get('azureopenai.apiVersion', { infer: true }) ||
        '2024-04-01-preview',
      deployment:
        this.configService.get('azureopenai.deployment', { infer: true }) ||
        'gpt-4o-mini',
    });
  }

  async chat(
    messages: ChatMessage[],
    options?: ModelApiOptions,
  ): Promise<ModelResponse> {
    const response = await this.azureOpenAI.chat.completions.create({
      model: options?.model || this.defaultModel,
      messages: messages as ChatCompletionMessageParam[],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: false,
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error('No response content from AzureOpenAI');
    }

    return {
      content: choice.message.content,
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  chatStream(
    messages: ChatMessage[],
    options?: ModelApiOptions,
  ): Observable<StreamChunk> {
    return new Observable<StreamChunk>((observer) => {
      this.azureOpenAI.chat.completions
        .create({
          model: this.defaultModel,
          messages: messages as ChatCompletionMessageParam[],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens,
          stream: true,
        })
        .then(async (stream) => {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            const done = chunk.choices[0]?.finish_reason !== null;

            observer.next({
              content,
              done,
            });

            if (done) {
              observer.complete();
              break;
            }
          }
        })
        .catch((error) => {
          observer.error(error);
        });
    });
  }

  getAvailableModels(): string[] {
    return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
  }
}

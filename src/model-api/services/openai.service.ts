import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Observable } from 'rxjs';
import {
  ModelApiService,
  ChatMessage,
  StreamChunk,
  ModelResponse,
  ModelApiOptions,
} from '../interfaces/model-api.interface';
import { AllConfigType } from '../../config/config.type';

@Injectable()
export class OpenAiService extends ModelApiService {
  private openai: OpenAI;
  private defaultModel = 'gpt-4o-mini';

  constructor(private configService: ConfigService<AllConfigType>) {
    super();
    this.openai = new OpenAI({
      apiKey: this.configService.get('openai.apiKey', { infer: true }),
    });
  }

  async chat(
    messages: ChatMessage[],
    options?: ModelApiOptions,
  ): Promise<ModelResponse> {
    const response = await this.openai.chat.completions.create({
      model: options?.model || this.defaultModel,
      messages:
        messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: false,
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error('No response content from OpenAI');
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
      this.openai.chat.completions
        .create({
          model: options?.model || this.defaultModel,
          messages:
            messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
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

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
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
export class ClaudeService extends ModelApiService {
  private anthropic: Anthropic;
  private defaultModel = 'claude-3-5-sonnet-20241022';

  constructor(private configService: ConfigService<AllConfigType>) {
    super();
    this.anthropic = new Anthropic({
      apiKey: this.configService.get('claude.apiKey', { infer: true }),
    });
  }

  async chat(
    messages: ChatMessage[],
    options?: ModelApiOptions,
  ): Promise<ModelResponse> {
    // Convert messages to Anthropic format
    const anthropicMessages = this.convertToAnthropicMessages(messages);

    const response = await this.anthropic.messages.create({
      model: options?.model || this.defaultModel,
      messages: anthropicMessages,
      max_tokens: options?.maxTokens || 4000,
      temperature: options?.temperature ?? 0.7,
      stream: false,
    });

    if (!response.content || response.content.length === 0) {
      throw new Error('No response content from Claude');
    }

    const textContent = response.content.find((item) => item.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    return {
      content: textContent.text,
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens:
              response.usage.input_tokens + response.usage.output_tokens,
          }
        : undefined,
    };
  }

  chatStream(
    messages: ChatMessage[],
    options?: ModelApiOptions,
  ): Observable<StreamChunk> {
    return new Observable<StreamChunk>((observer) => {
      const anthropicMessages = this.convertToAnthropicMessages(messages);

      this.anthropic.messages
        .create({
          model: options?.model || this.defaultModel,
          messages: anthropicMessages,
          max_tokens: options?.maxTokens || 4000,
          temperature: options?.temperature ?? 0.7,
          stream: true,
        })
        .then(async (stream) => {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              observer.next({
                content: chunk.delta.text,
                done: false,
              });
            } else if (chunk.type === 'message_stop') {
              observer.next({
                content: '',
                done: true,
              });
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
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  private convertToAnthropicMessages(
    messages: ChatMessage[],
  ): Anthropic.Messages.MessageParam[] {
    // Anthropic requires alternating user/assistant messages and doesn't support system role in messages
    // We'll convert system messages to user messages with a prefix
    return messages.map((message) => {
      if (message.role === 'system') {
        return {
          role: 'user' as const,
          content: `System: ${message.content}`,
        };
      }
      return {
        role: message.role as 'user' | 'assistant',
        content: message.content,
      };
    });
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
export class GeminiService extends ModelApiService {
  private genAI: GoogleGenerativeAI;
  private defaultModel = 'gemini-1.5-flash';

  constructor(private configService: ConfigService<AllConfigType>) {
    super();
    const apiKey = this.configService.get('gemini.apiKey', { infer: true });
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey as string);
  }

  async chat(
    messages: ChatMessage[],
    options?: ModelApiOptions,
  ): Promise<ModelResponse> {
    const model = this.genAI.getGenerativeModel({
      model: options?.model || this.defaultModel,
    });

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    const chat = model.startChat({
      history: history,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens,
      },
    });

    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;
    const content = response.text();

    return {
      content,
      model: options?.model || this.defaultModel,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  chatStream(
    messages: ChatMessage[],
    options?: ModelApiOptions,
  ): Observable<StreamChunk> {
    return new Observable<StreamChunk>((observer) => {
      const model = this.genAI.getGenerativeModel({
        model: options?.model || this.defaultModel,
      });

      // Convert messages to Gemini format
      const history = messages.slice(0, -1).map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const lastMessage = messages[messages.length - 1];

      const chat = model.startChat({
        history: history,
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens,
        },
      });

      chat
        .sendMessageStream(lastMessage.content)
        .then(async (result) => {
          for await (const chunk of result.stream) {
            const content = chunk.text();
            observer.next({
              content,
              done: false,
            });
          }

          observer.next({
            content: '',
            done: true,
          });
          observer.complete();
        })
        .catch((error) => {
          observer.error(error);
        });
    });
  }

  getAvailableModels(): string[] {
    return ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
  }
}

import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Observable } from 'rxjs';
import {
  ModelApiService,
  ChatMessage,
  StreamChunk,
  ModelResponse,
  ModelApiOptions,
} from '../interfaces/model-api.interface';
import ollamaConfig from '../config/ollama.config';

@Injectable()
export class OllamaService extends ModelApiService {
  constructor(
    @Inject(ollamaConfig.KEY)
    private config: ConfigType<typeof ollamaConfig>,
  ) {
    super();
  }

  async chat(
    messages: ChatMessage[],
    options?: ModelApiOptions,
  ): Promise<ModelResponse> {
    const model = options?.model || this.config.defaultModel;

    const response = await fetch(`${this.config.url}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (!data.message?.content) {
      throw new Error('No response content from Ollama');
    }

    return {
      content: data.message.content,
      model: data.model,
      usage:
        data.prompt_eval_count && data.eval_count
          ? {
              promptTokens: data.prompt_eval_count,
              completionTokens: data.eval_count,
              totalTokens: data.prompt_eval_count + data.eval_count,
            }
          : undefined,
    };
  }

  chatStream(
    messages: ChatMessage[],
    options?: ModelApiOptions,
  ): Observable<StreamChunk> {
    return new Observable<StreamChunk>((observer) => {
      const model = options?.model || this.config.defaultModel;

      fetch(`${this.config.url}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens,
          },
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              `Ollama API error: ${response.status} ${response.statusText}`,
            );
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('No response body from Ollama');
          }

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              observer.complete();
              break;
            }

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter((line) => line.trim());

            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                const content = data.message?.content || '';
                const isDone = data.done === true;

                observer.next({
                  content,
                  done: isDone,
                });

                if (isDone) {
                  observer.complete();
                  return;
                }
              } catch {
                // Skip invalid JSON lines
                continue;
              }
            }
          }
        })
        .catch((error) => {
          observer.error(error);
        });
    });
  }

  getAvailableModels(): string[] {
    // These are common Ollama models, but in a real implementation
    // you might want to fetch this from the /api/tags endpoint
    return [
      'llama3.2',
      'llama3.1',
      'llama3',
      'llama2',
      'mistral',
      'codellama',
      'vicuna',
      'orca-mini',
    ];
  }
}

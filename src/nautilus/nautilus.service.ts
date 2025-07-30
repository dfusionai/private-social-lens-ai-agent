import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  NautilusRequest,
  NautilusResponse,
  BlobFilePair,
  NautilusConfig,
  ParsedNautilusResult,
} from './interfaces/nautilus.interface';

@Injectable()
export class NautilusService {
  private readonly logger = new Logger(NautilusService.name);
  private readonly config: NautilusConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.config = this.configService.get<NautilusConfig>('nautilus', {
      infer: true,
    })!;
  }

  private parseNautilusResponse(
    response: NautilusResponse,
  ): ParsedNautilusResult[] {
    try {
      if (response.status !== 'success') {
        throw new Error(
          `Nautilus operation failed with status: ${response.status}`,
        );
      }

      if (response.exit_code !== 0) {
        throw new Error(
          `Nautilus process failed with exit code: ${response.exit_code}. stderr: ${response.stderr}`,
        );
      }

      const responseData = response.data;

      if (responseData.status !== 'success') {
        throw new Error(
          `Nautilus data operation failed with status: ${responseData.status}`,
        );
      }

      const results: ParsedNautilusResult[] = [];

      for (const result of responseData.results) {
        if (result.status === 'success' && result.message) {
          const msg = result.message;

          // Build structured content format
          const content = `Sent at: ${msg.date}, Sent by user ID: ${msg.user_id}, Message: ${msg.message}, Conversation Id: ${msg.chat_id}, Current User Id: ${msg.user_id}`;

          results.push({
            content,
            metadata: {
              walrus_blob_id: result.walrus_blob_id,
              on_chain_file_obj_id: result.on_chain_file_obj_id,
              policy_object_id: result.policy_object_id,
              message_index: result.message_index,
              encrypted_object_id: result.encrypted_object_id,
              attestation_obj_id: result.attestation_obj_id,
            },
          });
        } else {
          this.logger.warn(
            `Failed to decrypt blob ${result.walrus_blob_id}: ${result.error || 'Unknown error'}`,
          );
        }
      }

      this.logger.debug(
        `Parsed Nautilus response: ${results.length}/${responseData.total_requested} successful decryptions`,
      );

      return results;
    } catch (error) {
      this.logger.error('Failed to parse Nautilus response:', error);
      throw new Error(`Failed to parse Nautilus response: ${error.message}`);
    }
  }

  async retrieveRawMessage(
    walrusBlobId: string,
    onChainFileObjId: string,
    policyObjectId: string,
    address: string,
    options?: {
      threshold?: string;
      timeout_secs?: number;
    },
  ): Promise<{ content: string; metadata?: Record<string, any> }> {
    try {
      const blobFilePair: BlobFilePair = {
        walrusBlobId,
        onChainFileObjId,
        policyObjectId,
      };

      const request: NautilusRequest = {
        payload: {
          blobFilePairs: [blobFilePair],
          address,
          policyObjectId,
          threshold: options?.threshold || this.config.defaultThreshold,
          timeout_secs: options?.timeout_secs || this.config.defaultTimeout,
        },
      };

      this.logger.debug(
        `Retrieving raw message from Nautilus: ${walrusBlobId}`,
      );

      const response = await firstValueFrom(
        this.httpService.post<NautilusResponse>(
          `${this.config.url}/retrieve_messages_by_blob_ids`,
          request,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout:
              (options?.timeout_secs || this.config.defaultTimeout) * 1000,
          },
        ),
      );

      const parsedResults = this.parseNautilusResponse(response.data);

      if (parsedResults.length === 0) {
        throw new Error('No successful decryptions returned from Nautilus');
      }

      const result = parsedResults[0]; // Get first result for single message retrieval

      this.logger.debug(
        `Successfully retrieved message from Nautilus: ${walrusBlobId}`,
      );

      return {
        content: result.content,
        metadata: result.metadata,
      };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve raw message from Nautilus for blob ${walrusBlobId}:`,
        error,
      );
      throw new Error(
        `Failed to retrieve raw message from Nautilus: ${error.message}`,
      );
    }
  }

  async retrieveMultipleRawMessages(
    blobFilePairs: BlobFilePair[],
    address: string,
    options?: {
      policyObjectId?: string;
      threshold?: string;
      timeout_secs?: number;
    },
  ): Promise<{ content: string; metadata?: Record<string, any> }[]> {
    try {
      const request: NautilusRequest = {
        payload: {
          blobFilePairs,
          address,
          policyObjectId: options?.policyObjectId,
          threshold: options?.threshold || this.config.defaultThreshold,
          timeout_secs: options?.timeout_secs || this.config.defaultTimeout,
        },
      };

      this.logger.debug(
        `Retrieving ${blobFilePairs.length} raw messages from Nautilus`,
      );

      this.logger.debug(
        `Request payload: ${JSON.stringify(request.payload, null, 2)}`,
      );

      const response = await firstValueFrom(
        this.httpService.post<NautilusResponse>(
          `${this.config.url}/retrieve_messages_by_blob_ids`,
          request,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout:
              (options?.timeout_secs || this.config.defaultTimeout) * 1000,
          },
        ),
      );

      const parsedResults = this.parseNautilusResponse(response.data);

      this.logger.debug(
        `Successfully retrieved ${parsedResults.length}/${blobFilePairs.length} messages from Nautilus`,
      );

      return parsedResults.map((result) => ({
        content: result.content,
        metadata: result.metadata,
      }));
    } catch (error) {
      this.logger.error(
        'Failed to retrieve multiple raw messages from Nautilus:',
        error,
      );
      throw new Error(
        `Failed to retrieve multiple raw messages from Nautilus: ${error.message}`,
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.config.url}/health`, {
          timeout: 5000,
        }),
      );

      return response.status === 200;
    } catch (error) {
      this.logger.warn('Nautilus health check failed:', error.message);
      return false;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import FormData from 'form-data';
import {
  QuiltPatch,
  QuiltPatchMetadata,
  QuiltPublishResult,
} from '../domain/walrus-quilt';
import { BatchDownloadResult } from '../domain/downloaded-submission';
import { SubmissionConfig } from '../config/submission-config.type';
import { AllConfigType } from '../../config/config.type';
import { IdMaskerService } from '../../utils/id-masker.service';
import { SealService } from './seal.service';
import { SuiBlockchainService } from './sui-blockchain.service';

@Injectable()
export class WalrusQuiltService {
  private readonly logger = new Logger(WalrusQuiltService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly idMasker: IdMaskerService,
    private readonly jwtService: JwtService,
    private readonly sealService: SealService,
    private readonly suiBlockchainService: SuiBlockchainService,
  ) {}

  /**
   * Extract all chats from downloaded submissions and create quilt patches
   */
  extractChatsToPatches(downloadResult: BatchDownloadResult): QuiltPatch[] {
    const patches: QuiltPatch[] = [];

    for (const submission of downloadResult.submissions) {
      for (const chat of submission.data.chats) {
        // Mask IDs for Walrus metadata (publicly accessible)
        const maskedUserId = this.idMasker.reversiblyMaskUserId(
          downloadResult.userId,
        );
        const maskedSubmissionId = this.idMasker.reversiblyMaskSubmissionId(
          submission.submissionId,
        );
        const maskedChatId = this.idMasker.reversiblyMaskChatId(chat.chat_id);

        // Create unique identifier for this patch using masked IDs
        // Format: p-{maskedSubmissionId}-{maskedChatId}
        // Prefix with 'p-' to ensure it starts with an alphanumeric character
        // (base64 strings can start with +, /, = which are not alphanumeric)
        // Tags already contain userId, so we don't need it in the identifier
        const identifier = `p-${maskedSubmissionId}-${maskedChatId}`;

        // Create chat blob (JSON) - keep original data (not masked)
        // This will be encrypted later as an extra step
        const chatBlob = JSON.stringify({
          chat_id: chat.chat_id, // Original chat ID
          contents: chat.contents, // Original contents
          submissionId: submission.submissionId, // Original submission ID
          userId: downloadResult.userId, // Original user ID
          revision: submission.data.revision,
          source: submission.data.source,
        });

        // Create metadata with masked IDs for user isolation (publicly accessible)
        // These can be unmasked later for queries
        // Only include essential fields (userId, submissionId, chatId) in tags
        const tags = {
          userId: maskedUserId,
          submissionId: maskedSubmissionId,
          chatId: maskedChatId,
        };

        const metadata: QuiltPatchMetadata = {
          identifier,
          tags,
        };

        patches.push({
          identifier,
          content: Buffer.from(chatBlob, 'utf8'),
          metadata,
        });
      }
    }

    this.logger.log(
      `Extracted ${patches.length} chat patches from ${downloadResult.submissions.length} submissions`,
    );

    return patches;
  }

  /**
   * Publish a quilt to Walrus publisher
   */
  async publishQuilt(
    patches: QuiltPatch[],
    epochs: number = 1,
  ): Promise<QuiltPublishResult> {
    try {
      const submissionConfig = this.configService.getOrThrow<SubmissionConfig>(
        'submission',
        { infer: true },
      );

      if (patches.length === 0) {
        throw new Error('Cannot publish empty quilt');
      }

      // Validate patch count (Walrus supports up to 666 patches per quilt)
      if (patches.length > 666) {
        throw new Error(
          `Too many patches: ${patches.length}. Walrus supports maximum 666 patches per quilt.`,
        );
      }

      this.logger.log(
        `Publishing quilt with ${patches.length} patches to ${submissionConfig.walrusPublisherUrl}`,
      );

      // Create form data
      const formData = new FormData();

      // Encrypt each patch blob with Seal before adding to form data
      // This matches the frontend encryption pattern
      // NOTE: Seal encryption is ONLY used for chat blobs (patches), nothing else
      this.logger.debug(
        `Encrypting ${patches.length} patch blobs with Seal before publishing...`,
      );

      for (const patch of patches) {
        try {
          // Encrypt the patch content using Seal encryption
          // The policyObjectId is used to generate the encryption ID
          const { encryptedBytes, encryptionId } =
            await this.sealService.encryptData(
              patch.content,
              submissionConfig.policyObjectId,
            );

          this.logger.debug(
            `Encrypted patch ${patch.identifier} with encryption ID: ${encryptionId}`,
          );

          // Add encrypted patch as a form field with identifier as field name
          // The content is now encrypted bytes instead of plain JSON
          formData.append(patch.identifier, Buffer.from(encryptedBytes), {
            filename: `${patch.identifier}.encrypted`,
            contentType: 'application/octet-stream', // Encrypted data is binary
          });
        } catch (error: any) {
          this.logger.error(
            `Failed to encrypt patch ${patch.identifier}: ${error.message}`,
            error.stack,
          );
          throw new Error(
            `Failed to encrypt patch ${patch.identifier}: ${error.message}`,
          );
        }
      }

      // Add metadata field (must be named _metadata)
      const metadataArray = patches.map((patch) => ({
        identifier: patch.identifier,
        tags: patch.metadata.tags,
      }));
      formData.append('_metadata', JSON.stringify(metadataArray));

      // Generate JWT token if JWT secret is configured
      let authHeader: string | undefined;
      if (submissionConfig.walrusPublisherJwtSecret) {
        const now = Math.floor(Date.now() / 1000);
        const expiringSec =
          submissionConfig.walrusPublisherJwtExpiringSec || 300; // Default 5 minutes
        const exp = now + expiringSec;

        const payload: any = {
          exp, // Expiration timestamp (required)
          jti: randomUUID(), // JWT ID - unique identifier to prevent replay attacks (required)
          iat: now, // Issued at (optional)
          epochs, // Exact number of epochs (per Walrus spec)
        };

        // Sign JWT with the secret
        // Handle hex-encoded secret (with or without 0x prefix)
        let jwtSecret: string | Buffer =
          submissionConfig.walrusPublisherJwtSecret;
        if (jwtSecret && typeof jwtSecret === 'string') {
          // If secret starts with 0x, remove it and convert hex to buffer
          if (jwtSecret.startsWith('0x')) {
            const secretHex = jwtSecret.slice(2);
            jwtSecret = Buffer.from(secretHex, 'hex');
          } else if (/^[0-9a-fA-F]+$/.test(jwtSecret)) {
            // If it's a hex string without 0x, convert to buffer
            jwtSecret = Buffer.from(jwtSecret, 'hex');
          }
        }

        const algorithm = (submissionConfig.walrusPublisherJwtAlgorithm ||
          'HS256') as any;
        const token = await this.jwtService.signAsync(payload, {
          secret: jwtSecret,
          algorithm, // Default algorithm for Walrus publisher
        });

        authHeader = `Bearer ${token}`;

        this.logger.debug(
          `JWT token generated with claims: epochs=${payload.epochs}, jti=${payload.jti}`,
        );
      } else {
        this.logger.warn(
          'Walrus publisher JWT secret not configured. Request will be sent without authentication.',
        );
      }

      // Send HTTP request to Walrus publisher
      const baseUrl = submissionConfig.walrusPublisherUrl.replace(/\/$/, ''); // Remove trailing slash
      const url = `${baseUrl}/v1/quilts?epochs=${epochs}`;
      const headers = formData.getHeaders();

      // Add Authorization header if JWT token was generated
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }

      this.logger.debug(`Sending PUT request to ${url}`);

      const response = await this.httpService.axiosRef.put(url, formData, {
        headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000, // 5 minutes timeout for large quilts
      });

      this.logger.log(
        `Successfully published quilt. Response status: ${response.status}`,
      );

      // Parse response
      const responseData = response.data;

      // Extract on-chain blob object ID from newlyCreated
      const onChainBlobObjectId =
        responseData.blobStoreResult?.newlyCreated?.blobObject?.id;

      // Extract quilt blob ID from newlyCreated
      const quiltBlobId =
        responseData.blobStoreResult?.newlyCreated?.blobObject?.blobId;

      // Handle alreadyCertified case (if quilt was already stored)
      const alreadyCertifiedBlobId =
        responseData.blobStoreResult?.alreadyCertified?.blobId;

      if (!quiltBlobId && !alreadyCertifiedBlobId) {
        throw new Error(
          'Invalid response from Walrus publisher: missing quilt blob ID',
        );
      }

      // Use alreadyCertified blobId if newlyCreated is not available
      const finalQuiltBlobId = quiltBlobId || alreadyCertifiedBlobId;
      // For alreadyCertified, we don't have the on-chain ID, so use blobId as fallback
      const finalOnChainId = onChainBlobObjectId || finalQuiltBlobId;

      // Map stored quilt blobs to our result format
      const storedBlobs = responseData.storedQuiltBlobs || [];
      const result: QuiltPublishResult = {
        quiltId: finalOnChainId, // On-chain blob object ID (or blobId if alreadyCertified)
        quiltBlobId: finalQuiltBlobId, // Quilt blob ID
        patches: storedBlobs.map((storedBlob: any) => {
          // Find the original patch to get userId, submissionId, chatId
          const originalPatch = patches.find(
            (p) => p.identifier === storedBlob.identifier,
          );

          return {
            identifier: storedBlob.identifier,
            quiltPatchId: storedBlob.quiltPatchId,
            userId: originalPatch?.metadata.tags.userId || '',
            submissionId: originalPatch?.metadata.tags.submissionId || '',
            chatId: originalPatch?.metadata.tags.chatId || '',
          };
        }),
        totalPatches: storedBlobs.length,
        publishedAt: new Date(),
      };

      this.logger.log(
        `Quilt published successfully. On-chain ID: ${result.quiltId}, Blob ID: ${result.quiltBlobId}, Patches: ${result.totalPatches}`,
      );

      // After successful PUT request, save encrypted quilt on-chain (once per quilt upload)
      // Use the blob object ID from the response (blobStoreResult.newlyCreated.blobObject.id)
      if (onChainBlobObjectId) {
        this.logger.log(
          `Saving encrypted quilt on-chain (blob object ID: ${onChainBlobObjectId})...`,
        );

        try {
          // Create metadata for the quilt
          const metadata = {
            quiltId: result.quiltId,
            quiltBlobId: result.quiltBlobId,
            blobObjectId: onChainBlobObjectId,
            totalPatches: result.totalPatches,
          };

          // Save encrypted quilt on-chain (once per quilt upload, not per patch)
          // Use the blob object ID directly (no encryption needed - only chat patches are encrypted)
          const onChainFileObjId =
            await this.suiBlockchainService.saveEncryptedFileOnChain(
              onChainBlobObjectId,
              submissionConfig.policyObjectId,
              metadata,
            );

          this.logger.log(
            `✅ Encrypted quilt saved on-chain: ${onChainFileObjId}`,
          );

          // Store the on-chain file object ID in the result
          result.onChainFileObjId = onChainFileObjId;
        } catch (error: any) {
          this.logger.error(
            `Failed to save quilt on-chain: ${error.message}`,
            error.stack,
          );
          // Don't throw - log error but continue
          // The quilt is still published to Walrus, just not saved on-chain
        }
      } else {
        this.logger.warn(
          'No blob object ID found in response. Skipping on-chain save.',
        );
      }

      return result;
    } catch (error: any) {
      this.logger.error('Failed to publish quilt to Walrus:', error);

      // If it's an HTTP error, log more details
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        let errorMessage: string;

        try {
          // Walrus publisher returns errors in nested structure: {error: {message: "...", ...}}
          if (typeof errorData === 'object' && errorData !== null) {
            errorMessage =
              errorData?.error?.message ||
              errorData?.message ||
              error.message ||
              `HTTP ${status}`;
          } else if (typeof errorData === 'string') {
            // Try to parse as JSON
            try {
              const parsed = JSON.parse(errorData);
              errorMessage =
                parsed?.error?.message ||
                parsed?.message ||
                errorData ||
                `HTTP ${status}`;
            } catch {
              errorMessage = errorData || `HTTP ${status}`;
            }
          } else {
            errorMessage = `HTTP ${status}`;
          }
        } catch {
          errorMessage = `HTTP ${status}`;
        }

        // Provide specific error messages for common scenarios
        if (status === 401 || status === 403) {
          this.logger.error(
            `Publisher authentication failed (${status}): ${errorMessage}.`,
          );
          throw new Error(
            `Authentication failed: Publisher rejected JWT token.`,
          );
        } else {
          this.logger.error(`Publisher returned ${status}: ${errorMessage}`);
          throw new Error(`HTTP ${status}: ${errorMessage}`);
        }
      } else if (error.request) {
        // Request was made but no response received (network error, connection aborted, etc.)
        this.logger.error(
          `Request failed: No response received from publisher. This may indicate: 1) Network connectivity issue, 2) Publisher server closed the connection, or 3) Timeout.`,
        );
        throw new Error(
          `Request failed: No response received from publisher. Check network connectivity and publisher status.`,
        );
      } else {
        // Error occurred in setting up the request
        this.logger.error(`Request setup failed: ${error.message}`);
        throw new Error(`Request setup failed: ${error.message}`);
      }
    }
  }

  /**
   * Process batch download result: extract chats and publish as quilt
   */
  async processAndPublishQuilt(
    downloadResult: BatchDownloadResult,
    epochs: number = 1,
  ): Promise<QuiltPublishResult> {
    try {
      // Extract chats to patches
      const patches = this.extractChatsToPatches(downloadResult);

      if (patches.length === 0) {
        throw new Error('No chats found in downloaded submissions');
      }

      // Publish quilt
      const result = await this.publishQuilt(patches, epochs);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process and publish quilt for user ${this.idMasker.maskUserId(downloadResult.userId)}:`,
        error,
      );
      throw error;
    }
  }
}

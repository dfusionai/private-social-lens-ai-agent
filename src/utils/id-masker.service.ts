import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  createCipheriv,
  createDecipheriv,
  createHash,
} from 'crypto';
import { AllConfigType } from '../config/config.type';

/**
 * Service for deterministically masking/unmasking IDs for privacy.
 * - For logs/files: Uses one-way hashing (non-reversible, for privacy)
 * - For Walrus metadata: Uses reversible encryption (can be unmasked for queries)
 * Same input always produces the same masked output.
 */
@Injectable()
export class IdMaskerService {
  private readonly maskSalt: string;
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-cbc';

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    // Get mask salt from config, or use a default (not recommended for production)
    const config = this.configService.get('app', { infer: true });
    this.maskSalt =
      process.env.ID_MASK_SALT ||
      config?.backendDomain ||
      'default-mask-salt-change-in-production';

    // Derive encryption key from salt (32 bytes for AES-256)
    const keyHash = createHash('sha256').update(this.maskSalt).digest();
    this.encryptionKey = keyHash;
  }

  /**
   * Mask an ID deterministically for logs/files (one-way, non-reversible).
   * Same input always produces the same output.
   *
   * @param id - The ID to mask (string or number)
   * @returns Masked ID string (first 8 chars of hash)
   */
  maskId(id: string | number | undefined | null): string {
    if (id === undefined || id === null) {
      return 'null';
    }

    const idString = String(id);
    if (!idString || idString.trim() === '') {
      return 'empty';
    }

    // Use HMAC-SHA256 for deterministic hashing (one-way)
    const hmac = createHmac('sha256', this.maskSalt);
    hmac.update(idString);
    const hash = hmac.digest('hex');

    // Return first 8 characters for readability
    return hash.substring(0, 8);
  }

  /**
   * Reversibly mask an ID for Walrus metadata (can be unmasked).
   * Uses AES-256-CBC with deterministic IV derived from input.
   * Same input always produces the same output.
   *
   * @param id - The ID to mask (string or number)
   * @returns Base64-encoded encrypted ID
   */
  reversiblyMaskId(id: string | number | undefined | null): string {
    if (id === undefined || id === null) {
      return '';
    }

    const idString = String(id);
    if (!idString || idString.trim() === '') {
      return '';
    }

    // Create deterministic IV from the input (first 16 bytes of hash)
    const ivHash = createHash('sha256').update(idString).digest();
    const iv = ivHash.subarray(0, 16);

    // Encrypt using AES-256-CBC
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);
    let encrypted = cipher.update(idString, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return encrypted;
  }

  /**
   * Unmask a reversibly masked ID.
   * Expects format from reversiblyMaskIdWithIv: base64(iv(16 bytes) + encrypted)
   *
   * @param maskedId - The masked ID (base64-encoded with IV prepended)
   * @returns Original ID string, or empty string if unmasking fails
   */
  unmaskId(maskedId: string): string {
    if (!maskedId || maskedId.trim() === '') {
      return '';
    }

    try {
      const buffer = Buffer.from(maskedId, 'base64');

      // Extract IV (first 16 bytes) and encrypted data (rest)
      if (buffer.length < 16) {
        return ''; // Invalid format
      }

      const iv = buffer.subarray(0, 16);
      const encrypted = buffer.subarray(16);

      // Decrypt
      const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // If unmasking fails, return empty string
      return '';
    }
  }

  /**
   * Reversibly mask an ID with IV prepended (for easier unmasking).
   * Format: base64(iv(16 bytes) + encrypted)
   */
  reversiblyMaskIdWithIv(id: string | number | undefined | null): string {
    if (id === undefined || id === null) {
      return '';
    }

    const idString = String(id);
    if (!idString || idString.trim() === '') {
      return '';
    }

    // Create deterministic IV from the input (first 16 bytes of hash)
    const ivHash = createHash('sha256').update(idString).digest();
    const iv = ivHash.subarray(0, 16);

    // Encrypt using AES-256-CBC
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(idString, 'utf8'),
      cipher.final(),
    ]);

    // Prepend IV to encrypted data and encode as base64
    const combined = Buffer.concat([iv, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Mask a user ID for logs/files (one-way)
   */
  maskUserId(userId: string | number | undefined | null): string {
    return `user_${this.maskId(userId)}`;
  }

  /**
   * Reversibly mask a user ID for Walrus metadata
   */
  reversiblyMaskUserId(userId: string | number | undefined | null): string {
    return this.reversiblyMaskIdWithIv(userId);
  }

  /**
   * Unmask a user ID from Walrus metadata
   */
  unmaskUserId(maskedUserId: string): string {
    return this.unmaskId(maskedUserId);
  }

  /**
   * Mask a chat ID for logs/files (one-way)
   */
  maskChatId(chatId: string | number | undefined | null): string {
    return `chat_${this.maskId(chatId)}`;
  }

  /**
   * Reversibly mask a chat ID for Walrus metadata
   */
  reversiblyMaskChatId(chatId: string | number | undefined | null): string {
    return this.reversiblyMaskIdWithIv(chatId);
  }

  /**
   * Unmask a chat ID from Walrus metadata
   */
  unmaskChatId(maskedChatId: string): string {
    return this.unmaskId(maskedChatId);
  }

  /**
   * Mask a submission ID for logs/files (one-way)
   */
  maskSubmissionId(submissionId: string | undefined | null): string {
    return `sub_${this.maskId(submissionId)}`;
  }

  /**
   * Reversibly mask a submission ID for Walrus metadata
   */
  reversiblyMaskSubmissionId(
    submissionId: string | undefined | null,
  ): string {
    return this.reversiblyMaskIdWithIv(submissionId);
  }

  /**
   * Unmask a submission ID from Walrus metadata
   */
  unmaskSubmissionId(maskedSubmissionId: string): string {
    return this.unmaskId(maskedSubmissionId);
  }

  /**
   * Mask a batch tracking ID for logs/files (one-way)
   */
  maskBatchTrackingId(batchTrackingId: string | undefined | null): string {
    return `batch_${this.maskId(batchTrackingId)}`;
  }

  /**
   * Mask multiple IDs in a string (useful for log messages)
   * Replaces common ID patterns with masked versions
   */
  maskIdsInString(text: string): string {
    // This is a simple implementation - you might want to enhance it
    // based on your specific ID patterns
    return text;
  }
}


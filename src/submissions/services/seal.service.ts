import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubmissionConfig } from '../config/submission-config.type';
import { AllConfigType } from '../../config/config.type';
import { CreateSubmissionDto } from '../dto/create-submission.dto';
import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { fromHex, toHex } from '@mysten/sui/utils';
import { getRandomValues } from 'crypto';
import { SuiBlockchainService } from './sui-blockchain.service';

/**
 * Service for encrypting and decrypting data using Seal encryption.
 * Combines encryption and decryption functionality in a single service.
 * Matches the frontend encryption pattern from dev-notes/seal/encrypt.ts
 * Follows NestJS best practices with proper dependency injection and lifecycle hooks.
 *
 * Note: This service requires @mysten/seal and @mysten/sui packages to be installed.
 * Install with: npm install @mysten/seal @mysten/sui
 */
@Injectable()
export class SealService implements OnModuleInit {
  private readonly logger = new Logger(SealService.name);
  private readonly submissionConfig: SubmissionConfig;
  private sealClient: any; // SealClient from @mysten/seal
  private suiClient: any; // SuiClient from @mysten/sui
  private movePackageId: string | null = null;
  private keyServers: string[] = [];
  private rubyNodesApiKey: string | undefined;
  private encryptionThreshold: number = 1;
  private isInitialized = false;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly suiBlockchainService: SuiBlockchainService,
  ) {
    this.submissionConfig = this.configService.get<SubmissionConfig>(
      'submission',
      { infer: true },
    );
  }

  /**
   * Initialize service on module init (NestJS lifecycle hook)
   */
  onModuleInit(): void {
    this.initializeSealClient();
  }

  private initializeSealClient(): void {
    try {
      if (!this.submissionConfig.movePackageId) {
        this.logger.warn(
          'Move Package ID not configured. Seal encryption/decryption will not be available.',
        );
        return;
      }

      this.movePackageId = this.submissionConfig.movePackageId;

      if (
        !this.submissionConfig.sealKeyServers ||
        this.submissionConfig.sealKeyServers.length === 0
      ) {
        this.logger.warn(
          'Seal key servers not configured. Seal encryption/decryption will not be available.',
        );
        return;
      }

      this.keyServers = this.submissionConfig.sealKeyServers;
      this.rubyNodesApiKey = this.submissionConfig.sealRubyNodesApiKey;
      this.encryptionThreshold =
        this.submissionConfig.sealEncryptionThreshold || 1;

      // Initialize Sui client
      const network = this.submissionConfig.suiNetwork || 'mainnet';
      const rpcUrl = getFullnodeUrl(network);
      this.suiClient = new SuiClient({ url: rpcUrl });

      // Initialize Seal client
      this.sealClient = new SealClient({
        suiClient: this.suiClient,
        serverConfigs: this.keyServers.map((id) => ({
          objectId: id,
          weight: 1,
          ...(this.rubyNodesApiKey && {
            apiKey: this.rubyNodesApiKey,
            apiKeyName: 'x-api-key',
          }),
        })),
        verifyKeyServers: false,
      });

      this.isInitialized = true;
      this.logger.log(
        '✅ Seal service initialized successfully (encryption and decryption available)',
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to initialize Seal client. Make sure @mysten/seal and @mysten/sui are installed: ${error.message}`,
        error.stack,
      );
      // Don't throw - allow service to continue without Seal if not configured
      // This is a graceful degradation pattern
    }
  }

  /**
   * Encrypt data using Seal encryption.
   * Matches the frontend encryptData pattern from dev-notes/seal/encrypt.ts
   *
   * @param data - The data to encrypt (string or Buffer)
   * @param policyObjectId - The policy object ID for encryption
   * @returns Object containing encrypted bytes (Uint8Array) and encryption ID (hex string)
   * @throws BadRequestException if service is not initialized or parameters are invalid
   * @throws InternalServerErrorException if encryption fails
   */
  async encryptData(
    data: string | Buffer,
    policyObjectId: string,
  ): Promise<{ encryptedBytes: Uint8Array; encryptionId: string }> {
    if (!this.isInitialized || !this.sealClient || !this.movePackageId) {
      throw new BadRequestException(
        'Seal service not initialized. Check configuration and ensure @mysten/seal is installed.',
      );
    }

    if (!data || !policyObjectId) {
      throw new BadRequestException(
        'Missing required parameters for encryption: data and policyObjectId are required.',
      );
    }

    try {
      // Generate encryption ID: policyObjectId bytes + 5-byte nonce
      // This matches the frontend pattern
      const policyObjectBytes = fromHex(policyObjectId);
      const nonce = getRandomValues(new Uint8Array(5));
      const encryptionId = toHex(
        new Uint8Array([...policyObjectBytes, ...nonce]),
      );

      this.logger.debug(`🔷 Seal encryption ID: ${encryptionId}`);

      // Convert data to Uint8Array
      let dataBytes: Uint8Array;
      if (typeof data === 'string') {
        dataBytes = new Uint8Array(new TextEncoder().encode(data));
      } else {
        dataBytes = new Uint8Array(data);
      }

      // Encrypt the data
      const { encryptedObject: encryptedBytes } = await this.sealClient.encrypt(
        {
          threshold: this.encryptionThreshold,
          packageId: this.movePackageId,
          id: encryptionId,
          data: dataBytes,
        },
      );

      if (!encryptedBytes) {
        throw new Error('Failed to encrypt data - no encrypted bytes returned');
      }

      this.logger.debug(`✅ Data encrypted successfully`);

      return {
        encryptedBytes,
        encryptionId,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to encrypt data: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to encrypt data: ${error.message}`,
      );
    }
  }

  /**
   * Encrypt data and return as base64-encoded string.
   * Convenience method for when you need the encrypted data as a string.
   *
   * @param data - The data to encrypt (string or Buffer)
   * @param policyObjectId - The policy object ID for encryption
   * @returns Object containing base64-encoded encrypted data and encryption ID
   */
  async encryptDataAsBase64(
    data: string | Buffer,
    policyObjectId: string,
  ): Promise<{ encryptedData: string; encryptionId: string }> {
    const { encryptedBytes, encryptionId } = await this.encryptData(
      data,
      policyObjectId,
    );

    // Convert Uint8Array to base64
    const encryptedData = Buffer.from(encryptedBytes).toString('base64');

    return {
      encryptedData,
      encryptionId,
    };
  }

  /**
   * Decrypt encrypted submission data.
   * This method follows the decryptFile pattern from decrypt.ts
   *
   * @param encryptedData - Base64-encoded encrypted bytes
   * @param encryptionId - The Seal encryption ID (fileObjectId)
   * @param policyObjectId - The policy object ID
   * @returns Decrypted CreateSubmissionDto
   * @throws BadRequestException if service is not initialized or parameters are invalid
   * @throws InternalServerErrorException if decryption fails
   */
  async decryptSubmission(
    encryptedData: string,
    encryptionId: string,
    policyObjectId: string,
  ): Promise<CreateSubmissionDto> {
    if (!this.isInitialized || !this.sealClient || !this.movePackageId) {
      throw new BadRequestException(
        'Seal service not initialized. Check configuration and ensure @mysten/seal is installed.',
      );
    }

    if (!encryptedData || !encryptionId || !policyObjectId) {
      throw new BadRequestException(
        'Missing required parameters for decryption: encryptedData, encryptionId, and policyObjectId are required.',
      );
    }

    try {
      // Convert base64 to Uint8Array
      const encryptedBytes = Uint8Array.from(
        Buffer.from(encryptedData, 'base64'),
      );

      // Step 1: Get the address
      let address: string;
      try {
        address = await this.suiBlockchainService.getKeypairAddress();
        this.logger.debug(`[address] 🎯 Got keypair address`);
      } catch (err: any) {
        this.logger.error(
          `[address] ❌ Failed to get keypair address: ${err.message}`,
          err.stack,
        );
        throw new InternalServerErrorException(
          `Failed to get keypair address: ${err.message}`,
        );
      }

      // Step 2: Create session key
      let sessionKey: any;
      try {
        sessionKey = await SessionKey.create({
          address,
          packageId: this.movePackageId,
          ttlMin: 10,
          suiClient: this.suiClient,
        });
        this.logger.debug(`[sessionKey.create] 🎯 SessionKey created`);
      } catch (err: any) {
        this.logger.error(
          `[sessionKey.create] ❌ Failed: ${err.message}`,
          err.stack,
        );
        throw new InternalServerErrorException(
          `Failed to create session key: ${err.message}`,
        );
      }

      // Step 3: Get message from sessionKey
      // getPersonalMessage() returns Uint8Array, not a string
      let message: string | Uint8Array;
      try {
        const rawMessage = sessionKey.getPersonalMessage();
        // Handle both string and Uint8Array/Buffer
        if (typeof rawMessage === 'string') {
          message = rawMessage;
        } else if (
          rawMessage instanceof Uint8Array ||
          Buffer.isBuffer(rawMessage)
        ) {
          // Convert Uint8Array to string for signing
          message = Buffer.from(rawMessage).toString('utf-8');
        } else {
          // Fallback: convert to string
          message = String(rawMessage);
        }
        this.logger.debug(
          `[sessionKey.getPersonalMessage] 🎯 Got personal message`,
        );
      } catch (err: any) {
        this.logger.error(
          `[sessionKey.getPersonalMessage] ❌ Failed: ${err.message}`,
          err.stack,
        );
        throw new InternalServerErrorException(
          `Failed to get personal message: ${err.message}`,
        );
      }

      // Step 4: Sign the message
      // signPersonalMessage now accepts string or Uint8Array/Buffer
      // and returns signature as base64 string (not decoded bytes)
      let signature: { signature: string };
      try {
        signature =
          await this.suiBlockchainService.signPersonalMessage(message);
        this.logger.debug(`[signPersonalMessage] 🎯 Signature generated`);
        // setPersonalMessageSignature expects the signature as a base64 string
        await sessionKey.setPersonalMessageSignature(signature.signature);
        this.logger.debug(
          `[setPersonalMessageSignature] 🎯 Personal message signature set`,
        );
      } catch (err: any) {
        this.logger.error(
          `[signPersonalMessage/setSignature] ❌ Failed: ${err.message}`,
          err.stack,
        );
        throw new InternalServerErrorException(
          `Failed to sign personal message: ${err.message}`,
        );
      }

      // Step 5: Approve the seal
      let txBytes: Uint8Array;
      try {
        txBytes = await this.suiBlockchainService.sealApprove(
          encryptionId,
          policyObjectId,
        );
        this.logger.debug(`[sealApprove] 🎯 Seal approval received`);
      } catch (err: any) {
        this.logger.error(`[sealApprove] ❌ Failed: ${err.message}`, err.stack);
        throw new InternalServerErrorException(
          `Failed to approve seal: ${err.message}`,
        );
      }

      // Step 6: Decrypt the file
      let decryptedBytes: Uint8Array;
      try {
        this.logger.debug(`[decrypt] 🔓 Decrypting file data...`);
        decryptedBytes = await this.sealClient.decrypt({
          data: encryptedBytes,
          sessionKey,
          txBytes,
          checkShareConsistency: false,
          checkLEEncoding: true,
        });
        this.logger.debug(`[decrypt] 🎯 File decrypted`);
      } catch (err: any) {
        this.logger.error(
          `[decrypt] ❌ File decryption failed: ${err.message}`,
          err.stack,
        );
        throw new InternalServerErrorException(
          `Failed to decrypt file: ${err.message}`,
        );
      }

      // Step 7: Decode and parse JSON
      try {
        const decoder = new TextDecoder('utf-8');
        const jsonString = decoder.decode(decryptedBytes);
        this.logger.debug(`[decode/parse] 🎯 File decoded, parsing JSON...`);
        const decryptedDto = JSON.parse(jsonString) as CreateSubmissionDto;
        return decryptedDto;
      } catch (err: any) {
        this.logger.error(
          `[decode/parse] ❌ JSON decode/parse failed: ${err.message}`,
          err.stack,
        );
        throw new InternalServerErrorException(
          `Failed to decode/parse decrypted data: ${err.message}`,
        );
      }
    } catch (err: any) {
      // This will catch errors re-thrown from any inner step
      this.logger.error(
        `❌ decryptSubmission failed: ${err.message}`,
        err.stack,
      );
      // Re-throw NestJS exceptions as-is, wrap others
      if (
        err instanceof BadRequestException ||
        err instanceof InternalServerErrorException
      ) {
        throw err;
      }
      throw new InternalServerErrorException(
        `Decryption failed: ${err.message}`,
      );
    }
  }

  /**
   * Parse encrypted object to extract encryption ID
   * @param encryptedData - Base64-encoded encrypted bytes
   * @returns The encryption ID as a hex string
   * @throws BadRequestException if encrypted data is invalid
   * @throws InternalServerErrorException if parsing fails
   */
  parseEncryptedObject(encryptedData: string): string {
    if (!encryptedData) {
      throw new BadRequestException('Encrypted data is required');
    }

    try {
      const encryptedBytes = Uint8Array.from(
        Buffer.from(encryptedData, 'base64'),
      );
      const encryptedObject = EncryptedObject.parse(encryptedBytes);
      const encryptionId = toHex(encryptedObject.id as unknown as Uint8Array);
      this.logger.debug(`Parsed encrypted object with ID: ${encryptionId}`);
      return encryptionId;
    } catch (err: any) {
      this.logger.error(
        `Failed to parse encrypted object: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        `Failed to parse encrypted object: ${err.message}`,
      );
    }
  }
}

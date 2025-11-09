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
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import { bech32 } from 'bech32';

/**
 * Service for handling Sui blockchain operations required for Seal decryption.
 * This service provides the operations needed by SealService.
 * Follows NestJS best practices with proper dependency injection and lifecycle hooks.
 *
 * Note: This service requires @mysten/sui and bech32 packages to be installed.
 * Install with: npm install @mysten/sui bech32
 */
@Injectable()
export class SuiBlockchainService implements OnModuleInit {
  private readonly logger = new Logger(SuiBlockchainService.name);
  private readonly submissionConfig: SubmissionConfig;
  private keypair: any; // Ed25519Keypair from @mysten/sui/keypairs/ed25519
  private suiClient: any; // SuiClient from @mysten/sui/client
  private movePackageId: string | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    this.submissionConfig = this.configService.get<SubmissionConfig>(
      'submission',
      { infer: true },
    );
  }

  /**
   * Initialize service on module init (NestJS lifecycle hook)
   */
  async onModuleInit(): Promise<void> {
    // Lazy initialization - only initialize when needed
    // This allows the service to be created even if dependencies aren't available
  }

  /**
   * Initialize keypair and Sui client (lazy initialization pattern)
   */
  private async initialize(): Promise<void> {
    if (this.keypair) {
      return; // Already initialized
    }

    // Prevent concurrent initialization
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = Promise.resolve(this._doInitialize());
    return this.initializationPromise;
  }

  private _doInitialize(): void {
    try {
      // Get bech32-encoded private key from config (NestJS standard)
      const suiSecretKey = this.submissionConfig.suiSecretKey;

      if (!suiSecretKey) {
        throw new BadRequestException(
          'Sui secret key not configured. Set SUI_SECRET_KEY environment variable.',
        );
      }

      // Decode bech32 private key
      // Try multiple formats robustly (matching SuiWalletService pattern)
      try {
        // Prefer bech32 suiprivkey (schema-prefixed format)
        if (suiSecretKey.startsWith('suiprivkey')) {
          const decoded = bech32.decode(suiSecretKey);
          if (!decoded) {
            throw new Error('Invalid bech32 private key');
          }
          const words = bech32.fromWords(decoded.words);
          if (!words || words.length < 33) {
            throw new Error('Invalid suiprivkey length');
          }
          // First byte is the scheme flag; following 32 bytes are the secret
          const rawSecretKey = Buffer.from(words).slice(1, 33);
          this.keypair = Ed25519Keypair.fromSecretKey(rawSecretKey);
        } else {
          // Fallback: try bech32 decode without suiprivkey prefix
          const decoded = bech32.decode(suiSecretKey);
          if (!decoded) {
            throw new Error('Invalid bech32 private key format');
          }
          const privateKeyBytes = bech32.fromWords(decoded.words);
          const rawSecretKey = Buffer.from(privateKeyBytes).subarray(1);
          this.keypair = Ed25519Keypair.fromSecretKey(rawSecretKey);
        }
      } catch (error: any) {
        throw new BadRequestException(
          `Invalid bech32 private key format: ${error.message}`,
        );
      }

      if (!this.submissionConfig.movePackageId) {
        throw new BadRequestException(
          'Move Package ID not configured. Set MOVE_PACKAGE_ID environment variable.',
        );
      }

      this.movePackageId = this.submissionConfig.movePackageId;

      // Initialize Sui client
      const network = this.submissionConfig.suiNetwork || 'mainnet';
      const rpcUrl = getFullnodeUrl(network);
      this.suiClient = new SuiClient({ url: rpcUrl });

      const address = this.keypair.getPublicKey().toSuiAddress();
      this.isInitialized = true;
      this.logger.log(
        `✅ Sui blockchain service initialized with address: ${address}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to initialize Sui keypair: ${error.message}`,
        error.stack,
      );
      // Re-throw NestJS exceptions as-is, wrap others
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to initialize Sui blockchain service: ${error.message}`,
      );
    }
  }

  /**
   * Get the keypair address
   * @throws BadRequestException if keypair is not initialized
   */
  async getKeypairAddress(): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.keypair) {
      throw new BadRequestException(
        'Sui keypair not initialized. Check SUI_SECRET_KEY configuration.',
      );
    }
    return this.keypair.getPublicKey().toSuiAddress();
  }

  /**
   * Sign a personal message
   * @param message - The message to sign (string or Uint8Array/Buffer)
   * @returns Signature object with signature as base64 string
   * @throws InternalServerErrorException if signing fails
   */
  async signPersonalMessage(
    message: string | Uint8Array | Buffer,
  ): Promise<{ signature: string }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // signPersonalMessage expects a Buffer
      const messageBuffer =
        message instanceof Uint8Array || Buffer.isBuffer(message)
          ? Buffer.from(message)
          : Buffer.from(message);

      const result = await this.keypair.signPersonalMessage(messageBuffer);

      // keypair.signPersonalMessage returns { bytes: string, signature: string }
      // Both are base64-encoded strings. setPersonalMessageSignature expects
      // the signature as a base64 string (NOT decoded bytes)
      // Return the signature directly as a base64 string
      return {
        signature: result.signature,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to sign personal message: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to sign personal message: ${error.message}`,
      );
    }
  }

  /**
   * Approve the seal (generate transaction bytes for seal_approve)
   * @param fileObjectId - The Seal encryption ID (file object ID)
   * @param policyObjectId - The policy object ID
   * @returns Transaction bytes for seal approval
   * @throws BadRequestException if service is not initialized
   * @throws InternalServerErrorException if transaction building fails
   */
  async sealApprove(
    fileObjectId: string,
    policyObjectId: string,
  ): Promise<Uint8Array> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.movePackageId || !this.suiClient || !this.keypair) {
      throw new BadRequestException(
        'Sui blockchain service not properly initialized. Check configuration.',
      );
    }

    try {
      this.logger.debug(`🔐 Creating seal approval transaction...`);

      // Build transaction for seal_approve
      const tx = new Transaction();
      tx.setGasBudget(10_000_000);
      tx.setSender(this.keypair.getPublicKey().toSuiAddress());

      // Call seal_approve function matching the reference implementation
      // fileObjectId is passed as vector<u8> (fromHex converts hex to bytes)
      // policyObjectId is passed as an object
      tx.moveCall({
        target: `${this.movePackageId}::seal_manager::seal_approve`,
        arguments: [
          tx.pure.vector('u8', fromHex(fileObjectId)),
          tx.object(policyObjectId),
        ],
      });

      // Build transaction bytes (only transaction kind, not full transaction)
      const txBytes = await tx.build({
        client: this.suiClient,
        onlyTransactionKind: true,
      });

      this.logger.debug(`✅ Seal approval transaction built`);
      return txBytes;
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to create seal approval: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create seal approval transaction: ${error.message}`,
      );
    }
  }

  /**
   * Save encrypted file on-chain via seal_manager::save_encrypted_file
   * @param fileId - The Seal encryption ID (file object ID) as hex string
   * @param policyObjId - The policy object ID
   * @param metadata - File metadata object
   * @returns On-chain file object ID
   * @throws BadRequestException if service is not initialized
   * @throws InternalServerErrorException if transaction fails
   */
  async saveEncryptedFileOnChain(
    fileId: string,
    policyObjId: string,
    metadata: Record<string, any>,
  ): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.movePackageId || !this.suiClient || !this.keypair) {
      throw new BadRequestException(
        'Sui blockchain service not properly initialized. Check configuration.',
      );
    }

    try {
      this.logger.log('💾 Saving encrypted file on-chain...');

      const sender = this.keypair.getPublicKey().toSuiAddress();
      const tx = new Transaction();
      tx.setSender(sender);
      tx.setGasBudget(10_000_000);

      const metadataBytes = new Uint8Array(
        new TextEncoder().encode(JSON.stringify(metadata)),
      );

      tx.moveCall({
        target: `${this.movePackageId}::seal_manager::save_encrypted_file`,
        arguments: [
          tx.pure.vector('u8', fromHex(fileId)),
          tx.object(policyObjId),
          tx.pure.vector('u8', metadataBytes),
        ],
      });

      const result = await this.suiClient.signAndExecuteTransaction({
        transaction: tx,
        signer: this.keypair,
        requestType: 'WaitForLocalExecution',
        options: {
          showEffects: true,
        },
      } as any);

      const onChainFileObjId =
        (result as any).effects?.created?.[0]?.reference?.objectId || '';

      if (!onChainFileObjId) {
        throw new Error(
          'Failed to save encrypted file onchain. No on-chain file object created.',
        );
      }

      this.logger.log(
        `✅ Encrypted file saved on-chain: ${onChainFileObjId}. Tx: ${(result as any).digest}`,
      );
      return onChainFileObjId;
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to save encrypted file on-chain: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to save encrypted file on-chain: ${error.message}`,
      );
    }
  }
}

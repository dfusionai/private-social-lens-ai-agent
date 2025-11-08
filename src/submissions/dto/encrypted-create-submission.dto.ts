import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

/**
 * Container DTO for encrypted submission data.
 * Since the entire CreateSubmissionDto is encrypted, we need metadata
 * properties that are accessible before decryption.
 */
export class EncryptedCreateSubmissionDto {
  @ApiProperty({
    description: 'Encrypted CreateSubmissionDto as base64-encoded Uint8Array',
    example: 'base64-encoded-encrypted-data',
  })
  @IsString()
  @IsNotEmpty()
  encryptedData: string; // Base64-encoded encrypted bytes

  @ApiProperty({
    description: 'Number of chats in the submission (from chats.length)',
    example: 150,
  })
  @IsNumber()
  @IsNotEmpty()
  submissionChatCount: number;

  @ApiProperty({
    description: 'The Seal encryption ID used for this encryption',
    example: '0x1234567890abcdef...',
  })
  @IsString()
  @IsNotEmpty()
  encryptionId: string;

  @ApiProperty({
    description: 'Wallet address for token gating',
    example: '0x1234567890123456789012345678901234567890',
  })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;
}

import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { SubmissionService } from './services/submission.service';
import { EncryptedCreateSubmissionDto } from './dto/encrypted-create-submission.dto';
import { UsersService } from '../users/users.service';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import {
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AllConfigType } from '../config/config.type';

@ApiTags('Submissions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'submissions',
  version: '1',
})
export class SubmissionsController {
  constructor(
    private readonly submissionService: SubmissionService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new submission',
    description:
      "Submit encrypted chats data which will be stored temporarily in Azure Blob Storage until batch threshold is reached. The encrypted data contains the CreateSubmissionDto encrypted with Seal. The user ID in the encrypted payload must match the authenticated user's telegram ID.",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Submission created successfully',
    schema: {
      type: 'object',
      properties: {
        submissionId: {
          type: 'string',
          format: 'uuid',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
        chatCount: {
          type: 'number',
          example: 150,
          description:
            'Total number of chats for this user after this submission',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Invalid input data, batch is being processed, or user ID in submission does not match authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated or user not found',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Submission creation is currently disabled',
  })
  @HttpCode(HttpStatus.CREATED)
  async createSubmission(
    @Request() request: { user: JwtPayloadType },
    @Body() encryptedSubmissionDto: EncryptedCreateSubmissionDto,
  ): Promise<{ submissionId: string; chatCount: number }> {
    // Check if submission creation is enabled
    const createSubmissionEnabled = this.configService.get(
      'submission.createSubmissionEnabled',
      { infer: true },
    );
    if (createSubmissionEnabled === false) {
      throw new ServiceUnavailableException(
        'Submission creation is currently disabled',
      );
    }

    // Fetch the full user object to get the socialId (telegram ID)
    const user = await this.usersService.findById(request.user.id);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.socialId) {
      throw new UnauthorizedException('User does not have a social ID');
    }

    return await this.submissionService.createSubmission(
      encryptedSubmissionDto,
      user.socialId,
    );
  }

  @Get('batch-status')
  @ApiOperation({
    summary: 'Get batch status',
    description:
      'Retrieve the current batch status for the authenticated user, including all batches',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Batch status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        batches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              batchNumber: { type: 'number', example: 1 },
              chatCount: { type: 'number', example: 450 },
              batchStatus: {
                type: 'string',
                enum: ['pending', 'processing', 'completed', 'failed'],
                example: 'pending',
              },
              retryCount: { type: 'number', example: 0 },
              maxRetries: { type: 'number', example: 3 },
              errorMessage: { type: 'string', nullable: true },
              quiltId: { type: 'string', nullable: true },
              epochs: { type: 'number', nullable: true, example: 53 },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        latestBatch: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'string', format: 'uuid' },
            batchNumber: { type: 'number', example: 1 },
            chatCount: { type: 'number', example: 450 },
            batchStatus: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed'],
              example: 'pending',
            },
            retryCount: { type: 'number', example: 0 },
            maxRetries: { type: 'number', example: 3 },
            errorMessage: { type: 'string', nullable: true },
            quiltId: { type: 'string', nullable: true },
            epochs: { type: 'number', nullable: true, example: 53 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated or user not found',
  })
  async getBatchStatus(@Request() request: { user: JwtPayloadType }) {
    // Fetch the full user object to get the socialId (telegram ID)
    const user = await this.usersService.findById(request.user.id);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.socialId) {
      throw new UnauthorizedException('User does not have a social ID');
    }

    const batches = await this.submissionService.getUserBatches(user.socialId);

    if (!batches || batches.length === 0) {
      return {
        batches: [],
        latestBatch: null,
      };
    }

    // Latest batch is the first one (ordered by batchNumber DESC)
    const latestBatch = batches[0];

    return {
      batches: batches.map((batch) => ({
        id: batch.id,
        batchNumber: batch.batchNumber,
        chatCount: batch.chatCount,
        batchStatus: batch.batchStatus,
        retryCount: batch.retryCount,
        maxRetries: batch.maxRetries,
        errorMessage: batch.errorMessage,
        quiltId: batch.quiltId,
        epochs: batch.epochs,
        createdAt: batch.createdAt,
      })),
      latestBatch: latestBatch
        ? {
            id: latestBatch.id,
            batchNumber: latestBatch.batchNumber,
            chatCount: latestBatch.chatCount,
            batchStatus: latestBatch.batchStatus,
            retryCount: latestBatch.retryCount,
            maxRetries: latestBatch.maxRetries,
            errorMessage: latestBatch.errorMessage,
            quiltId: latestBatch.quiltId,
            epochs: latestBatch.epochs,
            createdAt: latestBatch.createdAt,
          }
        : null,
    };
  }
}

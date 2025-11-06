import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SubmissionService } from './services/submission.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@ApiTags('Submissions')
@Controller({
  path: 'submissions',
  version: '1',
})
export class SubmissionsController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new submission',
    description:
      'Submit chats data which will be stored temporarily in Azure Blob Storage until batch threshold is reached. The user ID is taken from the submission data.',
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
    description: 'Invalid input data or batch is being processed',
  })
  @HttpCode(HttpStatus.CREATED)
  async createSubmission(
    @Body() createSubmissionDto: CreateSubmissionDto,
  ): Promise<{ submissionId: string; chatCount: number }> {
    return await this.submissionService.createSubmission(createSubmissionDto);
  }

  @Get('batch-status')
  @ApiOperation({
    summary: 'Get batch tracking status',
    description: 'Retrieve the current batch tracking status for a user',
  })
  @ApiQuery({
    name: 'userId',
    required: true,
    type: String,
    description: 'User ID from the submission data',
    example: '5619346142',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Batch tracking status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        chatCount: {
          type: 'number',
          example: 450,
        },
        batchStatus: {
          type: 'string',
          enum: ['pending', 'processing', 'completed'],
          example: 'pending',
        },
      },
    },
  })
  async getBatchStatus(@Query('userId') userId: string) {
    if (!userId) {
      return {
        chatCount: 0,
        batchStatus: 'pending',
      };
    }

    const batchTracking = await this.submissionService.getBatchTracking(userId);

    if (!batchTracking) {
      return {
        chatCount: 0,
        batchStatus: 'pending',
      };
    }

    return {
      chatCount: batchTracking.chatCount,
      batchStatus: batchTracking.batchStatus,
    };
  }
}

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { GetUser } from '../users/decorators/get-user.decorator';
import { User } from '../users/domain/user';
import { JobProducerService } from './services/job-producer.service';
import { JobMonitoringService } from './services/job-monitoring.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JobStatusDto } from './dto/job-status.dto';
import { FindJobsDto } from './dto/find-jobs.dto';
import { QueueHealthDto } from './dto/job-metrics.dto';
import { LatestCompletedJobDto } from './dto/latest-completed-job.dto';
import { InfinityPaginationResponseDto } from '../utils/dto/infinity-pagination-response.dto';

@ApiTags('Jobs')
@Controller('jobs')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class JobsController {
  constructor(
    private readonly jobProducer: JobProducerService,
    private readonly jobMonitoring: JobMonitoringService,
  ) {}

  @Post('data-processing')
  @ApiOperation({
    summary: 'Create a new data processing job',
    description:
      'Submit data for processing through TEE (Trusted Execution Environment)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Job created successfully',
    schema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          format: 'uuid',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or processing options',
  })
  @HttpCode(HttpStatus.CREATED)
  async createJob(
    @GetUser() user: User,
    @Body() createJobDto: CreateJobDto,
  ): Promise<{ jobId: string }> {
    const jobId = await this.jobProducer.createDataRefinementJob(
      user.id,
      createJobDto,
    );
    return { jobId };
  }

  @Get(':jobId/status')
  @ApiOperation({
    summary: 'Get job status',
    description: 'Retrieve the current status and details of a specific job',
  })
  @ApiParam({
    name: 'jobId',
    type: 'string',
    format: 'uuid',
    description: 'Job unique identifier',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job status retrieved successfully',
    type: JobStatusDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  async getJobStatus(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @GetUser() user: User,
  ): Promise<JobStatusDto> {
    return await this.jobProducer.getJobStatus(jobId, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get user jobs',
    description: 'Retrieve a paginated list of jobs for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Jobs retrieved successfully',
    type: InfinityPaginationResponseDto<JobStatusDto>,
  })
  async getUserJobs(
    @GetUser() user: User,
    @Query() query: FindJobsDto,
  ): Promise<InfinityPaginationResponseDto<JobStatusDto>> {
    return await this.jobProducer.findUserJobs(user.id, query);
  }

  @Get('latest-completed-at')
  @ApiOperation({
    summary: 'Get latest completed job timestamp',
    description:
      'Get the timestamp of the most recently completed job for the current user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Latest completed job timestamp retrieved successfully',
    type: LatestCompletedJobDto,
  })
  async getLatestCompletedJobTimestamp(
    @GetUser() user: User,
  ): Promise<LatestCompletedJobDto> {
    return await this.jobProducer.getLatestCompletedJob(user.id);
  }

  @Delete(':jobId')
  @ApiOperation({
    summary: 'Cancel job',
    description: 'Cancel a pending or queued job',
  })
  @ApiParam({
    name: 'jobId',
    type: 'string',
    format: 'uuid',
    description: 'Job unique identifier',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job cancellation result',
    schema: {
      type: 'object',
      properties: {
        cancelled: {
          type: 'boolean',
          example: true,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Job cannot be cancelled in current status',
  })
  @HttpCode(HttpStatus.OK)
  async cancelJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @GetUser() user: User,
  ): Promise<{ cancelled: boolean }> {
    const cancelled = await this.jobProducer.cancelJob(jobId, user.id);
    return { cancelled };
  }

  @Get('queue/health')
  @ApiOperation({
    summary: 'Get queue health status',
    description: 'Retrieve queue metrics and health information (admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue health retrieved successfully',
    type: QueueHealthDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.admin)
  async getQueueHealth(): Promise<QueueHealthDto> {
    return await this.jobMonitoring.getQueueHealth();
  }
}

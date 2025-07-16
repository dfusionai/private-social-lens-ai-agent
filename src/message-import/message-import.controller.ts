import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MessageImportService } from './message-import.service';
import {
  ImportMessageDto,
  ImportMessagesDto,
  MessagePlatform,
} from './dto/import-message.dto';
import { SearchMessagesDto } from './dto/search-messages.dto';
import { User } from '../users/domain/user';
import { GetUser } from '../users/decorators/get-user.decorator';

@ApiTags('Message Import')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'message-import',
  version: '1',
})
export class MessageImportController {
  constructor(private readonly messageImportService: MessageImportService) {}

  @Post('single')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Import a single message' })
  @ApiResponse({
    status: 201,
    description: 'Message imported successfully',
  })
  async importMessage(
    @GetUser() user: User,
    @Body() importMessageDto: ImportMessageDto,
  ) {
    return this.messageImportService.importMessage(
      String(user.id),
      importMessageDto,
    );
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Import multiple messages in batch' })
  @ApiResponse({
    status: 201,
    description: 'Messages imported successfully',
  })
  async importMessages(
    @GetUser() user: User,
    @Body() importMessagesDto: ImportMessagesDto,
  ) {
    return this.messageImportService.importMessages(
      String(user.id),
      importMessagesDto,
    );
  }

  @Get('search')
  @ApiOperation({ summary: 'Search imported messages by semantic similarity' })
  @ApiResponse({
    status: 200,
    description: 'Returns matching messages',
  })
  @ApiQuery({ name: 'query', description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Result limit' })
  @ApiQuery({
    name: 'threshold',
    required: false,
    description: 'Similarity threshold',
  })
  @ApiQuery({
    name: 'platform',
    enum: MessagePlatform,
    required: false,
    description: 'Filter by platform',
  })
  @ApiQuery({
    name: 'senderName',
    required: false,
    description: 'Filter by sender name',
  })
  @ApiQuery({
    name: 'chatName',
    required: false,
    description: 'Filter by chat name',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    description: 'Filter from date (ISO string)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    description: 'Filter to date (ISO string)',
  })
  async searchMessages(
    @GetUser() user: User,
    @Query() searchDto: SearchMessagesDto,
  ) {
    return this.messageImportService.searchMessages(String(user.id), searchDto);
  }

  @Get('platform/:platform')
  @ApiOperation({ summary: 'Get all messages from a specific platform' })
  @ApiResponse({
    status: 200,
    description: 'Returns messages from the specified platform',
  })
  @ApiParam({
    name: 'platform',
    enum: MessagePlatform,
    description: 'Platform name',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of messages to return',
  })
  async getMessagesByPlatform(
    @GetUser() user: User,
    @Param('platform') platform: MessagePlatform,
    @Query('limit') limit?: number,
  ) {
    return this.messageImportService.getMessagesByPlatform(
      String(user.id),
      platform,
      limit || 50,
    );
  }

  @Delete('platform/:platform')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete all messages from a specific platform' })
  @ApiResponse({
    status: 204,
    description: 'All messages from platform deleted successfully',
  })
  @ApiParam({
    name: 'platform',
    enum: MessagePlatform,
    description: 'Platform name',
  })
  deleteMessagesByPlatform(
    @GetUser() user: User,
    @Param('platform') platform: MessagePlatform,
  ) {
    return this.messageImportService.deleteMessagesByPlatform(
      String(user.id),
      platform,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get import statistics for current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns import statistics',
  })
  async getImportStats(@GetUser() user: User) {
    return this.messageImportService.getImportStats(String(user.id));
  }
}

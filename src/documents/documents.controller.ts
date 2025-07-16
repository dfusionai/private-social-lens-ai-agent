import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { SearchDocumentsDto } from './dto/search-documents.dto';
import { User } from '../users/domain/user';
import { GetUser } from '../users/decorators/get-user.decorator';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'documents',
  version: '1',
})
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload and index a document' })
  @ApiResponse({
    status: 201,
    description: 'Document uploaded and indexed successfully',
  })
  async uploadDocument(
    @GetUser() user: User,
    @Body() createDocumentDto: CreateDocumentDto,
  ) {
    return this.documentsService.uploadDocument(
      String(user.id),
      createDocumentDto,
    );
  }

  @Get('search')
  @ApiOperation({ summary: 'Search documents by semantic similarity' })
  @ApiResponse({
    status: 200,
    description: 'Returns matching documents',
  })
  @ApiQuery({ name: 'query', description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Result limit' })
  @ApiQuery({
    name: 'threshold',
    required: false,
    description: 'Similarity threshold',
  })
  @ApiQuery({
    name: 'conversationId',
    required: false,
    description: 'Filter by conversation',
  })
  async searchDocuments(
    @GetUser() user: User,
    @Query() searchDto: SearchDocumentsDto,
  ) {
    return this.documentsService.searchDocuments(String(user.id), searchDto);
  }

  @Get('my-documents')
  @ApiOperation({ summary: 'Get all documents for current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns all documents for the user',
  })
  async getUserDocuments(@GetUser() user: User) {
    return this.documentsService.getUserDocuments(String(user.id));
  }

  @Delete('my-documents')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete all documents for current user' })
  @ApiResponse({
    status: 204,
    description: 'All user documents deleted successfully',
  })
  async deleteUserDocuments(@GetUser() user: User) {
    return this.documentsService.deleteUserDocuments(String(user.id));
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get document collection statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns document collection statistics',
  })
  getDocumentStats() {
    return this.documentsService.getDocumentStats();
  }
}

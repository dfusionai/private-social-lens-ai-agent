import { Module } from '@nestjs/common';
import { RagModule } from '../rag/rag.module';
import { MessageImportService } from './message-import.service';
import { MessageImportController } from './message-import.controller';

@Module({
  imports: [RagModule],
  controllers: [MessageImportController],
  providers: [MessageImportService],
  exports: [MessageImportService],
})
export class MessageImportModule {}

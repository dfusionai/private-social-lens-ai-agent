import { Module, forwardRef } from '@nestjs/common';
import { SecureMessageService } from './secure-message.service';
import { SecureMessageController } from './secure-message.controller';
import { WalrusModule } from '../walrus/walrus.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [
    WalrusModule,
    EncryptionModule,
    EmbeddingsModule,
    forwardRef(() => RagModule),
  ],
  controllers: [SecureMessageController],
  providers: [SecureMessageService],
  exports: [SecureMessageService],
})
export class SecureMessageModule {}

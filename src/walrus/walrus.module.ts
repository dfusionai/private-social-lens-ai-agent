import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WalrusFactoryService } from './walrus-factory.service';
import { MockWalrusService } from './providers/mock-walrus.service';

@Module({
  imports: [ConfigModule],
  providers: [WalrusFactoryService, MockWalrusService],
  exports: [WalrusFactoryService],
})
export class WalrusModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { tokenGatingConfigEntity } from '../../../../token-gating-configs/infrastructure/persistence/relational/entities/token-gating-config.entity';
import { TokenGatingConfigSeedService } from './status-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([tokenGatingConfigEntity])],
  providers: [TokenGatingConfigSeedService],
  exports: [TokenGatingConfigSeedService],
})
export class TokenGatingConfigSeedModule {}

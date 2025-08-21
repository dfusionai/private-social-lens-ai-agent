import { Module } from '@nestjs/common';
import { tokenGatingConfigRepository } from '../token-gating-config.repository';
import { tokenGatingConfigRelationalRepository } from './repositories/token-gating-config.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { tokenGatingConfigEntity } from './entities/token-gating-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([tokenGatingConfigEntity])],
  providers: [
    {
      provide: tokenGatingConfigRepository,
      useClass: tokenGatingConfigRelationalRepository,
    },
  ],
  exports: [tokenGatingConfigRepository],
})
export class RelationaltokenGatingConfigPersistenceModule {}

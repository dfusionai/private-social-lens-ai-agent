import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { NautilusService } from './nautilus.service';
import nautilusConfig from './config/nautilus.config';

@Module({
  imports: [HttpModule, ConfigModule.forFeature(nautilusConfig)],
  providers: [NautilusService],
  exports: [NautilusService],
})
export class NautilusModule {}

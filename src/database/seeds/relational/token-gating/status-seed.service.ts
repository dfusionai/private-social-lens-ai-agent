import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { tokenGatingConfigEntity } from '../../../../token-gating-configs/infrastructure/persistence/relational/entities/token-gating-config.entity';

@Injectable()
export class TokenGatingConfigSeedService {
  constructor(
    @InjectRepository(tokenGatingConfigEntity)
    private repository: Repository<tokenGatingConfigEntity>,
  ) {}

  async run() {
    const count = await this.repository.count();

    if (!count) {
      await this.repository.save([
        this.repository.create({
          stakeThreshold: 0.1,
          balanceThreshold: 0.1,
        }),
      ]);
    }
  }
}

import {
  // common
  Injectable,
} from '@nestjs/common';
import { CreateTokenGatingConfigDto } from './dto/create-token-gating-config.dto';
import { UpdateTokenGatingConfigDto } from './dto/update-token-gating-config.dto';
import { tokenGatingConfigRepository } from './infrastructure/persistence/token-gating-config.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { tokenGatingConfig } from './domain/token-gating-config';

@Injectable()
export class tokenGatingConfigsService {
  constructor(
    // Dependencies here
    private readonly tokenGatingConfigRepository: tokenGatingConfigRepository,
  ) {}

  async create(createTokenGatingConfigDto: CreateTokenGatingConfigDto) {
    return this.tokenGatingConfigRepository.create(createTokenGatingConfigDto);
  }

  getLatestConfig() {
    return this.tokenGatingConfigRepository.getLatestConfig();
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.tokenGatingConfigRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: tokenGatingConfig['id']) {
    return this.tokenGatingConfigRepository.findById(id);
  }

  findByIds(ids: tokenGatingConfig['id'][]) {
    return this.tokenGatingConfigRepository.findByIds(ids);
  }

  async update(
    id: tokenGatingConfig['id'],
    updateTokenGatingConfigDto: UpdateTokenGatingConfigDto,
  ) {
    return this.tokenGatingConfigRepository.update(
      id,
      updateTokenGatingConfigDto,
    );
  }

  remove(id: tokenGatingConfig['id']) {
    return this.tokenGatingConfigRepository.remove(id);
  }
}

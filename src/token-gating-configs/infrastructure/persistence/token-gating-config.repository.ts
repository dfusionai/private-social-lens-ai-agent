import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { tokenGatingConfig } from '../../domain/token-gating-config';

export abstract class tokenGatingConfigRepository {
  abstract create(
    data: Omit<tokenGatingConfig, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<tokenGatingConfig>;

  abstract findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<tokenGatingConfig[]>;

  abstract findById(
    id: tokenGatingConfig['id'],
  ): Promise<NullableType<tokenGatingConfig>>;

  abstract findByIds(
    ids: tokenGatingConfig['id'][],
  ): Promise<tokenGatingConfig[]>;

  abstract getLatestConfig(): Promise<tokenGatingConfig>;

  abstract update(
    id: tokenGatingConfig['id'],
    payload: DeepPartial<tokenGatingConfig>,
  ): Promise<tokenGatingConfig | null>;

  abstract remove(id: tokenGatingConfig['id']): Promise<void>;
}

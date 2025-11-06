import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubmissionEntity } from '../entities/submission.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Submission } from '../../../../domain/submission';
import { SubmissionRepository } from '../../submission.repository';
import { SubmissionMapper } from '../mappers/submission.mapper';

@Injectable()
export class SubmissionRelationalRepository implements SubmissionRepository {
  constructor(
    @InjectRepository(SubmissionEntity)
    private readonly submissionRepository: Repository<SubmissionEntity>,
  ) {}

  async create(data: Submission): Promise<Submission> {
    const persistenceModel = SubmissionMapper.toPersistence(data);
    const newEntity = await this.submissionRepository.save(
      this.submissionRepository.create(persistenceModel),
    );
    return SubmissionMapper.toDomain(newEntity);
  }

  async findById(id: Submission['id']): Promise<NullableType<Submission>> {
    const entity = await this.submissionRepository.findOne({
      where: { id },
    });

    return entity ? SubmissionMapper.toDomain(entity) : null;
  }

  async findByUserId(userId: number | string): Promise<Submission[]> {
    const entities = await this.submissionRepository.find({
      where: { userId: userId.toString() },
      order: {
        createdAt: 'DESC',
      },
    });

    return entities.map((entity) => SubmissionMapper.toDomain(entity));
  }

  async findByUserAndBatchStatus(
    userId: number | string,
    _batchStatus: string,
  ): Promise<Submission[]> {
    // This would need to join with user_batch_tracking table
    // For now, we'll return all submissions for the user
    // This can be enhanced later if needed
    return this.findByUserId(userId);
  }

  async update(
    id: Submission['id'],
    payload: Partial<Submission>,
  ): Promise<Submission> {
    const entity = await this.submissionRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.submissionRepository.save(
      this.submissionRepository.create(
        SubmissionMapper.toPersistence({
          ...SubmissionMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return SubmissionMapper.toDomain(updatedEntity);
  }

  async remove(id: Submission['id']): Promise<void> {
    await this.submissionRepository.softDelete(id);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { JobEntity } from '../entities/job.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Job } from '../../../../domain/job';
import { JobRepository } from '../../job.repository';
import { JobMapper } from '../mappers/job.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { JobStatus } from '../../../../enums/job-status.enum';
import { JobType } from '../../../../enums/job-type.enum';

@Injectable()
export class JobRelationalRepository implements JobRepository {
  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
  ) {}

  async create(data: Job): Promise<Job> {
    const persistenceModel = JobMapper.toPersistence(data);
    const newEntity = await this.jobRepository.save(
      this.jobRepository.create(persistenceModel),
    );
    return JobMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    userId,
    status,
    type,
    paginationOptions,
  }: {
    userId?: string | number;
    status?: JobStatus;
    type?: JobType;
    paginationOptions: IPaginationOptions;
  }): Promise<Job[]> {
    const whereCondition: any = {};

    if (userId) {
      whereCondition.user = { id: userId as any };
    }

    if (status) {
      whereCondition.status = status;
    }

    if (type) {
      whereCondition.type = type;
    }

    const entities = await this.jobRepository.find({
      where: whereCondition,
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: {
        createdAt: 'DESC',
      },
      relations: ['user'],
    });

    return entities.map((entity) => JobMapper.toDomain(entity));
  }

  async findById(id: Job['id']): Promise<NullableType<Job>> {
    const entity = await this.jobRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    return entity ? JobMapper.toDomain(entity) : null;
  }

  async findByIdAndUserId(
    id: Job['id'],
    userId: number | string,
  ): Promise<NullableType<Job>> {
    const entity = await this.jobRepository.findOne({
      where: { id, user: { id: userId as any } },
      relations: ['user'],
    });

    return entity ? JobMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Job['id'][]): Promise<Job[]> {
    const entities = await this.jobRepository.find({
      where: { id: In(ids) },
      relations: ['user'],
    });

    return entities.map((entity) => JobMapper.toDomain(entity));
  }

  async findByStatus(status: JobStatus): Promise<Job[]> {
    const entities = await this.jobRepository.find({
      where: { status },
      relations: ['user'],
    });

    return entities.map((entity) => JobMapper.toDomain(entity));
  }

  async findStuckJobs(timeoutMinutes: number): Promise<Job[]> {
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const entities = await this.jobRepository.find({
      where: {
        status: JobStatus.PROCESSING,
        startedAt: LessThan(cutoffTime),
      },
      relations: ['user'],
    });

    return entities.map((entity) => JobMapper.toDomain(entity));
  }

  async countByStatus(status: JobStatus): Promise<number> {
    return await this.jobRepository.count({
      where: { status },
    });
  }

  async findLatestCompletedByUserId(
    userId: number | string,
  ): Promise<NullableType<Job>> {
    const entity = await this.jobRepository.findOne({
      where: {
        user: { id: userId as any },
        status: JobStatus.COMPLETED,
      },
      order: {
        completedAt: 'DESC',
      },
      relations: ['user'],
    });

    return entity ? JobMapper.toDomain(entity) : null;
  }

  async update(id: Job['id'], payload: Partial<Job>): Promise<Job> {
    const entity = await this.jobRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.jobRepository.save(
      this.jobRepository.create(
        JobMapper.toPersistence({
          ...JobMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return JobMapper.toDomain(updatedEntity);
  }

  async remove(id: Job['id']): Promise<void> {
    await this.jobRepository.softDelete(id);
  }

  async removeOldCompletedJobs(olderThanDays: number): Promise<void> {
    const cutoffDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
    );

    await this.jobRepository.delete({
      status: JobStatus.COMPLETED,
      completedAt: LessThan(cutoffDate),
    });
  }
}

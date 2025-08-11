import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  Column,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { JobStatus } from '../../../../enums/job-status.enum';
import { JobType } from '../../../../enums/job-type.enum';

@Entity({
  name: 'job',
})
@Index(['status', 'createdAt'])
@Index(['user', 'status'])
@Index(['workerId'])
export class JobEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, { eager: true, nullable: false })
  user: UserEntity;

  @Column({
    type: 'varchar',
    length: 50,
    default: JobType.REFINEMENT,
  })
  type: JobType;

  @Column({
    type: 'varchar',
    length: 20,
    default: JobStatus.PENDING,
  })
  status: JobStatus;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  blobId: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  onchainFileId: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  policyId: string;

  @Column({
    type: 'int',
    nullable: true,
    default: 5,
  })
  priority?: number;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata?: Record<string, any>;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  resultData?: any;

  @Column({
    type: 'text',
    nullable: true,
  })
  errorMessage?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  workerId?: string;

  @Column({
    type: 'int',
    default: 0,
  })
  attempts: number;

  @Column({
    type: 'int',
    default: 3,
  })
  maxAttempts: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  pgBossJobId?: string;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  startedAt?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  completedAt?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  failedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt?: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}

import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
  Index,
  Unique,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { BatchStatus } from '../../../../domain/batch';

@Entity({
  name: 'batch',
})
@Unique(['userId', 'batchNumber'])
@Index(['userId', 'batchStatus'])
export class BatchEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  userId: string;

  @Column({
    type: 'int',
    nullable: false,
  })
  batchNumber: number;

  @Column({
    type: 'int',
    nullable: false,
    default: 0,
  })
  chatCount: number;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    default: 'pending',
  })
  batchStatus: BatchStatus;

  @Column({
    type: 'int',
    nullable: false,
    default: 0,
  })
  retryCount: number;

  @Column({
    type: 'int',
    nullable: false,
    default: 3,
  })
  maxRetries: number;

  @Column({
    type: 'text',
    nullable: true,
  })
  errorMessage?: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  quiltId?: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  quiltBlobId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt?: Date;
}


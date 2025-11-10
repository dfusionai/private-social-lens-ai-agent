import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { BatchEntity } from './batch.entity';

@Entity({
  name: 'submission',
})
@Index(['userId', 'createdAt'])
@Index(['batchId'])
export class SubmissionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  userId: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: false,
  })
  blobUrl: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: false,
  })
  blobName: string;

  @Column({
    type: 'int',
    nullable: false,
    default: 0,
  })
  chatCount: number;

  @ManyToOne(() => BatchEntity, { nullable: true })
  @JoinColumn({ name: 'batchId' })
  batch?: BatchEntity;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  batchId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt?: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}

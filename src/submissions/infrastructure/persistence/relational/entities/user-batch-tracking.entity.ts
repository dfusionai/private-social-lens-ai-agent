import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
  DeleteDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'user_batch_tracking',
})
@Unique(['userId'])
@Index(['userId', 'batchStatus'])
export class UserBatchTrackingEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true,
  })
  userId: string;

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
  batchStatus: 'pending' | 'processing' | 'completed';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt?: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}

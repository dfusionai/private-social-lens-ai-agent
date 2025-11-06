import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'submission',
})
@Index(['userId', 'createdAt'])
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt?: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}

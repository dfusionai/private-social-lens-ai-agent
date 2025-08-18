import { ConversationEntity } from '../../../../../conversations/infrastructure/persistence/relational/entities/conversation.entity';

import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'message',
})
export class MessageEntity extends EntityRelationalHelper {
  @Column({
    nullable: false,
    type: String,
  })
  content: string;

  @Column({
    nullable: false,
    type: String,
  })
  role: string;

  @ManyToOne(() => ConversationEntity, { eager: true, nullable: false })
  conversation: ConversationEntity;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

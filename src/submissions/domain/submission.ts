import { Exclude, Expose } from 'class-transformer';

export interface Chat {
  chat_id: number;
  contents: any[];
}

export interface SubmissionData {
  revision: string;
  source: string;
  user: string;
  submission_token: string;
  chats: Chat[];
}

export class Submission {
  @Expose()
  id: string;

  @Expose()
  userId: string;

  @Expose()
  blobUrl: string;

  @Expose()
  blobName: string;

  @Expose()
  chatCount: number;

  @Expose()
  batchId?: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt?: Date;

  @Exclude()
  deletedAt?: Date;

  constructor(partial: Partial<Submission>) {
    Object.assign(this, partial);
  }
}

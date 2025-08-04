import { JobType } from '../enums/job-type.enum';

export interface JobData {
  userId: number | string;
  customJobId: string;
  blobId: string;
  onchainFileId: string;
  policyId: string;
  jobType: JobType;
  priority?: number;
  metadata?: Record<string, any>;
}

export interface PgBossJob {
  id: string;
  name: string;
  data: JobData;
  done: Date | null;
  priority: number;
  state: string;
  retrycount: number;
  startafter: Date;
  startedon: Date | null;
  singletonkey: string | null;
  singletonon: Date | null;
  expirein: string;
  createdon: Date;
  completedon: Date | null;
  keepuntil: Date;
  on_complete: boolean;
  output: any;
}

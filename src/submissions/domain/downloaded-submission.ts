import { SubmissionData } from './submission';

export interface DownloadedSubmission {
  submissionId: string;
  blobName: string;
  blobUrl: string;
  data: SubmissionData;
  chatCount: number;
}

export interface BatchDownloadResult {
  userId: string;
  batchTrackingId: string;
  submissions: DownloadedSubmission[];
  totalChats: number;
  downloadedAt: Date;
}


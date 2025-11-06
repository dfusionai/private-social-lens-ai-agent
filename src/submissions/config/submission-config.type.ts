export type SubmissionConfig = {
  azureStorageAccountName: string;
  azureStorageAccountKey: string;
  azureStorageContainerName: string;
  batchChatThreshold: number;
  batchChatMaxThreshold: number;
  batchDownloadServiceUrl?: string;
};

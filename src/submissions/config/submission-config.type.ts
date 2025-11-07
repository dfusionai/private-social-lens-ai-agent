export type SubmissionConfig = {
  azureStorageAccountName: string;
  azureStorageAccountKey: string;
  azureStorageContainerName: string;
  batchChatThreshold: number;
  batchChatMaxThreshold: number;
  walrusPublisherUrl: string;
  walrusQuiltEpochs?: number;
  walrusPublisherJwtSecret?: string;
  walrusPublisherJwtAlgorithm?: string;
  walrusPublisherJwtExpiringSec?: number;
  policyObjectId: string;
};

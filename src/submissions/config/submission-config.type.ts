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
  blockchainRpcUrl?: string;
  tokenContractAddress?: string;
  stakingContractAddress?: string;
  // Seal encryption configuration
  sealMovePackageId?: string;
  sealKeyServers?: string[];
  sealEncryptionThreshold?: number;
  sealRubyNodesApiKey?: string;
  sealSuiNetwork?: string;
  sealSuiRpcUrl?: string;
  sealSuiSecretKey?: string; // Bech32-encoded private key for Seal decryption
};

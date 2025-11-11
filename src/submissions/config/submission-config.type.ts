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
  movePackageId?: string;
  sealKeyServers?: string[];
  sealEncryptionThreshold?: number;
  sealRubyNodesApiKey?: string;
  suiNetwork?: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  suiSecretKey?: string; // Bech32-encoded private key for Seal decryption
  createSubmissionEnabled?: boolean;
};

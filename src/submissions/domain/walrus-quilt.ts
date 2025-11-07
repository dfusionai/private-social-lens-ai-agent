export interface QuiltPatchMetadata {
  identifier: string;
  tags: {
    userId: string;
    submissionId: string;
    chatId: string;
  };
}

export interface QuiltPatch {
  identifier: string;
  content: Buffer;
  metadata: QuiltPatchMetadata;
}

export interface WalrusQuiltResponse {
  blobStoreResult: {
    newlyCreated?: {
      blobObject: {
        id: string;
        registeredEpoch: number;
        blobId: string;
        size: number;
        encodingType: string;
        certifiedEpoch: number | null;
        storage: {
          id: string;
          startEpoch: number;
          endEpoch: number;
          storageSize: number;
        };
        deletable: boolean;
      };
      resourceOperation: {
        registerFromScratch: {
          encodedLength: number;
          epochsAhead: number;
        };
      };
      cost: number;
    };
    alreadyCertified?: {
      blobId: string;
      event: {
        txDigest: string;
        eventSeq: string;
      };
      endEpoch: number;
    };
  };
  storedQuiltBlobs: Array<{
    identifier: string;
    quiltPatchId: string;
  }>;
}

export interface QuiltPublishResult {
  quiltId: string;
  quiltBlobId: string;
  patches: Array<{
    identifier: string;
    quiltPatchId: string;
    userId: string;
    submissionId: string;
    chatId: string;
  }>;
  totalPatches: number;
  publishedAt: Date;
}


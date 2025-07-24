export interface BlobFilePair {
  walrusBlobId: string;
  onChainFileObjId: string;
  policyObjectId: string;
}

export interface NautilusRequestPayload {
  blobFilePairs: BlobFilePair[];
  address: string;
  policyObjectId?: string;
  threshold: string;
  timeout_secs?: number;
}

export interface NautilusRequest {
  payload: NautilusRequestPayload;
}

export interface NautilusDecryptionResult {
  walrus_blob_id: string;
  on_chain_file_obj_id: string;
  policy_object_id: string;
  status: 'success' | 'failed';
  message?: string;
  encrypted_object_id?: string;
  attestation_obj_id?: string;
  error?: string;
}

export interface NautilusResponseData {
  status: string;
  operation: string;
  requested_pairs: BlobFilePair[];
  results: NautilusDecryptionResult[];
  total_requested: number;
  successful_decryptions: number;
  failed_decryptions: number;
}

export interface NautilusResponse {
  status: string;
  data: string; // JSON string that needs to be parsed
  stderr: string;
  exit_code: number;
  execution_time_ms: number;
}

export interface ParsedNautilusResult {
  content: string;
  metadata?: {
    walrus_blob_id: string;
    on_chain_file_obj_id: string;
    policy_object_id: string;
    encrypted_object_id?: string;
    attestation_obj_id?: string;
  };
}

export interface NautilusConfig {
  url: string;
  defaultTimeout: number;
  defaultThreshold: string;
}

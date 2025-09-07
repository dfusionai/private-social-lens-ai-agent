import { Injectable, Logger } from '@nestjs/common';
import { VectorDbService, SearchResult } from '../vector-db/vector-db.service';
import { NautilusService } from '../nautilus/nautilus.service';

export interface RagContext {
  query: string;
  retrievedDocuments: SearchResult[];
  contextText: string;
}

export interface RagSearchOptions {
  limit?: number;
  conversationId?: string;
  userId?: string;
  threshold?: number;
  excludeCurrentMessage?: boolean;
  currentQuery?: string;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly vectorDbService: VectorDbService,
    private readonly nautilusService: NautilusService,
  ) {}

  async retrieveContext(
    query: string,
    options: RagSearchOptions = {},
  ): Promise<RagContext> {
    const {
      limit = 5,
      conversationId,
      userId,
      threshold = 0.5,
      excludeCurrentMessage = false,
    } = options;

    try {
      let filter: Record<string, any> | undefined;

      // Priority: conversationId > userId > no filter
      // Map interface fields to vector metadata field names
      if (conversationId) {
        filter = { chat_id: conversationId }; // Use chat_id to match vector metadata
        this.logger.log(`Searching within conversation: ${conversationId}`);
      } else if (userId) {
        filter = { user_id: userId }; // Use user_id to match vector metadata (Telegram ID)
        this.logger.log(
          `Searching across ALL user data for Telegram ID: ${userId}`,
        );
      } else {
        this.logger.log('Searching without filters (global search)');
      }

      const searchResults = await this.vectorDbService.searchSimilar(
        query,
        limit,
        filter,
      );

      // Filter by threshold
      let filteredResults = searchResults.filter(
        (result) => result.score >= threshold,
      );

      // Filter out user's own identical messages if requested
      if (excludeCurrentMessage) {
        filteredResults = filteredResults.filter((result) => {
          // Exclude if it's the exact same question (score = 1.0) and from user
          const isIdenticalUserMessage =
            result.score === 1.0 &&
            result.metadata.role === 'user' &&
            result.content.toLowerCase().includes(query.toLowerCase());

          return !isIdenticalUserMessage;
        });
      }

      // Prioritize non-user messages (documents, assistant responses)
      filteredResults = filteredResults.sort((a, b) => {
        // Prefer documents (chat_history) over user messages
        if (
          a.metadata.source === 'chat_history' &&
          b.metadata.source !== 'chat_history'
        )
          return -1;
        if (
          b.metadata.source === 'chat_history' &&
          a.metadata.source !== 'chat_history'
        )
          return 1;

        // Then sort by score
        return b.score - a.score;
      });

      this.logger.log(
        `Pre-filter results: ${searchResults.length}, Post-filter: ${filteredResults.length}`,
      );

      const decryptedResults = await this.decryptSearchResults(filteredResults);
      const contextText = this.buildContextText(decryptedResults);

      return {
        query,
        retrievedDocuments: decryptedResults,
        contextText,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve RAG context:', error);
      throw error;
    }
  }

  private async decryptSearchResults(
    results: SearchResult[],
  ): Promise<SearchResult[]> {
    const decryptedResults: SearchResult[] = [];

    if (results.length === 0) {
      return decryptedResults;
    }

    // Group results by walrusBlobId for batching (all messages are encrypted)
    const blobFileMap = new Map<
      string,
      {
        walrusBlobId: string;
        onChainFileObjId: string;
        policyObjectId: string;
        messageIndices: number[];
        results: SearchResult[];
      }
    >();
    const invalidResults: SearchResult[] = [];

    for (const result of results) {
      const {
        original_blob_id,
        on_chain_file_obj_id,
        policy_object_id,
        message_index,
      } = result.metadata;

      if (
        original_blob_id &&
        on_chain_file_obj_id &&
        policy_object_id &&
        message_index !== undefined
      ) {
        // Group by walrusBlobId to batch requests efficiently
        if (!blobFileMap.has(original_blob_id)) {
          blobFileMap.set(original_blob_id, {
            walrusBlobId: original_blob_id,
            onChainFileObjId: on_chain_file_obj_id,
            policyObjectId: policy_object_id,
            messageIndices: [],
            results: [],
          });
        }

        const blobData = blobFileMap.get(original_blob_id)!;
        blobData.messageIndices.push(message_index);
        blobData.results.push(result);
      } else {
        // Results missing required Nautilus metadata
        this.logger.warn(
          `Missing Nautilus metadata for result ${JSON.stringify(result)}, skipping. Required: original_blob_id, on_chain_file_obj_id, policy_object_id, message_index`,
        );
        invalidResults.push(result);
      }
    }

    // Process all blobFilePairs in a single batched Nautilus request
    if (blobFileMap.size > 0) {
      try {
        const blobFilePairs = Array.from(blobFileMap.values()).map(
          (blobData) => ({
            walrusBlobId: blobData.walrusBlobId,
            onChainFileObjId: blobData.onChainFileObjId,
            policyObjectId: blobData.policyObjectId,
            messageIndices: blobData.messageIndices,
          }),
        );

        const totalMessageIndices = blobFilePairs.reduce(
          (sum, pair) => sum + pair.messageIndices.length,
          0,
        );

        this.logger.debug(
          `Batching ${blobFilePairs.length} blob files with ${totalMessageIndices} total message indices`,
        );

        const rawMessages =
          await this.nautilusService.retrieveMultipleRawMessages(blobFilePairs);

        // Map results back to search results by walrusBlobId + messageIndex
        const messageMap = new Map(
          rawMessages.map((msg) => [
            `${msg.metadata?.walrus_blob_id}:${msg.metadata?.message_index}`,
            msg.content,
          ]),
        );

        // Process all results from all blobs
        for (const [, blobData] of blobFileMap) {
          for (const result of blobData.results) {
            const lookupKey = `${result.metadata.original_blob_id}:${result.metadata.message_index}`;
            const content = messageMap.get(lookupKey);
            if (content) {
              decryptedResults.push({
                ...result,
                content,
              });
            } else {
              this.logger.warn(
                `No content found for blob ${JSON.stringify(result)} with message index ${result.metadata.message_index}, skipping`,
              );
            }
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to batch decrypt messages for ${blobFileMap.size} blobs:`,
          error,
        );

        // Skip all results as we cannot decrypt them
        for (const [, blobData] of blobFileMap) {
          for (const result of blobData.results) {
            this.logger.warn(
              `Skipping result ${result.id} due to decryption failure`,
            );
          }
        }
      }
    }

    return decryptedResults;
  }

  private buildContextText(documents: SearchResult[]): string {
    if (documents.length === 0) {
      return `You are an information retrieval assistant that summarizes content from Telegram chat history.

CHAT HISTORY:
No relevant data found.

INSTRUCTIONS:
- Only summarize and present information that exists in chat history
- If no relevant information found, respond: "I couldn’t find any chat history related to your question."
- Do not promise actions or services you cannot perform
- Do not mention sending emails, notifications, or any external actions
- Do not use emojis or icons
- Focus only on retrieving and presenting existing information`;
    }

    const contextParts = documents.map((doc) => {
      return `${doc.content}`;
    });

    return `You are an information retrieval assistant that summarizes content from Telegram chat history.

CHAT HISTORY:
${contextParts.join('\n\n')}

INSTRUCTIONS:
- Only summarize and present information that exists in the chat history above
- Give direct, concise answers without explanations or analysis
- Do not promise actions or services you cannot perform
- Do not mention sending emails, notifications, or any external actions
- Do not ask questions or suggest follow-up actions
- Do not use emojis or icons
- Focus only on retrieving and presenting existing information`;
  }

  async enhancePromptWithContext(
    userMessage: string,
    options: RagSearchOptions = {},
  ): Promise<string> {
    const ragContext = await this.retrieveContext(userMessage, options);

    this.logger.log(`\n=== RAG CONTEXT RETRIEVAL ===`);
    this.logger.log(`Search Query: "${userMessage}"`);
    this.logger.log(`Found Documents: ${ragContext.retrievedDocuments.length}`);
    this.logger.log(`Search Options:`, JSON.stringify(options, null, 2));

    if (ragContext.retrievedDocuments.length > 0) {
      this.logger.log('\n--- RETRIEVED DOCUMENTS ---');
      ragContext.retrievedDocuments.forEach((doc, index) => {
        this.logger.log(
          `[${index + 1}] Score: ${doc.score.toFixed(3)} | Source: ${doc.metadata.source || 'unknown'}`,
        );
        this.logger.log(
          `    Content: ${doc.content.substring(0, 150)}${doc.content.length > 150 ? '...' : ''}`,
        );
      });
      this.logger.log(`\n--- ENHANCED CONTEXT ---`);
      this.logger.log(ragContext.contextText.substring(0, 300) + '...');
    } else {
      this.logger.log('No relevant documents found - using original query');
    }
    this.logger.log('=== END RAG RETRIEVAL ===\n');

    if (ragContext.retrievedDocuments.length === 0) {
      return `${ragContext.contextText}
### MESSAGE TO RESPOND TO:
Message: ${userMessage}
### RESPONSE:`;
    }

    return `${ragContext.contextText}
### MESSAGE TO RESPOND TO:
Message: ${userMessage}
### RESPONSE:`;
  }

  async addMessageToContext(
    content: string,
    metadata: {
      conversationId: string;
      messageId: string;
      userId: string;
      role: 'user' | 'assistant';
      source?: string;
      fileHash?: string;
      isEncrypted?: boolean;
    },
  ): Promise<string> {
    try {
      const enhancedMetadata = {
        ...metadata,
        source: metadata.source || `${metadata.role}_message`,
        timestamp: new Date(),
        fileHash: metadata.fileHash,
        isEncrypted: metadata.isEncrypted || false,
      };

      const documentId = await this.vectorDbService.addDocument(
        content,
        enhancedMetadata,
      );

      this.logger.log(
        `Added message to vector database: ${documentId} for conversation ${metadata.conversationId}`,
      );

      return documentId;
    } catch (error) {
      this.logger.error('Failed to add message to context:', error);
      throw error;
    }
  }

  async removeConversationContext(conversationId: string): Promise<void> {
    try {
      await this.vectorDbService.deleteDocumentsByMetadata({
        conversationId,
      });
      this.logger.log(
        `Removed all context for conversation: ${conversationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to remove context for conversation ${conversationId}:`,
        error,
      );
      throw error;
    }
  }

  async summarizeConversation(conversationId: string): Promise<string[]> {
    try {
      const documents =
        await this.vectorDbService.getDocumentsByConversation(conversationId);

      return documents
        .sort(
          (a, b) =>
            new Date(a.metadata.timestamp).getTime() -
            new Date(b.metadata.timestamp).getTime(),
        )
        .map((doc) => `${doc.metadata.role}: ${doc.content}`);
    } catch (error) {
      this.logger.error(
        `Failed to summarize conversation ${conversationId}:`,
        error,
      );
      throw error;
    }
  }

  async searchConversationHistory(
    query: string,
    conversationId: string,
    limit: number = 10,
  ): Promise<SearchResult[]> {
    return this.vectorDbService.searchSimilar(query, limit, {
      conversationId,
    });
  }

  async searchUserHistory(
    query: string,
    userId: string,
    limit: number = 10,
  ): Promise<SearchResult[]> {
    return this.vectorDbService.searchSimilar(query, limit, { userId });
  }
}

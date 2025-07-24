import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { VectorDbService, SearchResult } from '../vector-db/vector-db.service';
import { SecureMessageService } from '../secure-message/secure-message.service';
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
    @Inject(forwardRef(() => SecureMessageService))
    private readonly secureMessageService: SecureMessageService,
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
      if (conversationId) {
        filter = { conversationId };
        this.logger.log(`Searching within conversation: ${conversationId}`);
      } else if (userId) {
        filter = { userId };
        this.logger.log(`Searching across ALL user data for userId: ${userId}`);
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

    // Group results by address for batching (all messages are encrypted)
    const groupedByAddress = new Map<string, SearchResult[]>();
    const invalidResults: SearchResult[] = [];

    for (const result of results) {
      const {
        walrus_blob_id,
        on_chain_file_obj_id,
        policy_object_id,
        request_address,
      } = result.metadata;

      if (
        walrus_blob_id &&
        on_chain_file_obj_id &&
        policy_object_id &&
        request_address
      ) {
        if (!groupedByAddress.has(request_address)) {
          groupedByAddress.set(request_address, []);
        }
        groupedByAddress.get(request_address)!.push(result);
      } else {
        // Results missing required Nautilus metadata
        this.logger.warn(
          `Missing Nautilus metadata for result ${result.id}, skipping. Required: walrus_blob_id, on_chain_file_obj_id, policy_object_id, request_address`,
        );
        invalidResults.push(result);
      }
    }

    // Process batched Nautilus requests
    for (const [address, addressResults] of groupedByAddress) {
      try {
        const blobFilePairs = addressResults.map((result) => ({
          walrusBlobId: result.metadata.walrus_blob_id,
          onChainFileObjId: result.metadata.on_chain_file_obj_id,
          policyObjectId: result.metadata.policy_object_id,
        }));

        this.logger.debug(
          `Batching ${blobFilePairs.length} Nautilus requests for address: ${address}`,
        );

        const rawMessages =
          await this.nautilusService.retrieveMultipleRawMessages(
            blobFilePairs,
            address,
          );

        // Map results back to search results by walrusBlobId
        const messageMap = new Map(
          rawMessages.map((msg) => [msg.metadata?.walrus_blob_id, msg.content]),
        );

        for (const result of addressResults) {
          const content = messageMap.get(result.metadata.walrus_blob_id);
          if (content) {
            decryptedResults.push({
              ...result,
              content,
            });
          } else {
            this.logger.warn(
              `No content found for blob ${result.metadata.walrus_blob_id}, skipping`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to batch decrypt messages for address ${address}:`,
          error,
        );

        // Skip these results as we cannot decrypt them
        for (const result of addressResults) {
          this.logger.warn(
            `Skipping result ${result.id} due to decryption failure for address ${address}`,
          );
        }
      }
    }

    return decryptedResults;
  }

  private buildContextText(documents: SearchResult[]): string {
    if (documents.length === 0) {
      return `### INSTRUCTIONS:
You are Dfusion AI, my personal AI assistant. Your name is "Dfusion AI" and you should identify yourself by this name when asked. You use retrieved context from my chat history in Qdrant to respond as I would, matching my communication style and honoring past commitments or preferences found in the context.

### AI IDENTITY:
- Your name is: Dfusion AI
- When asked about your name, respond that you are Dfusion AI
- You are a personal AI assistant

### CONTEXT RELEVANCE:
- Context score threshold: Use context with similarity > 0.7
- If multiple contexts conflict, prioritize the most recent (highest timestamp)
- If context seems irrelevant or fragmented, rely on general reasoning

### RETRIEVED CONTEXT:
No relevant context found.

### RESPONSE GUIDELINES:
1. Style Matching: Mirror my typical tone, formality level, and response length patterns from context
2. Consistency: Respect prior agreements, opinions, and relationship dynamics shown in context
3. Context Quality: 
   - Score >0.8: High confidence, use context heavily
   - Score 0.7-0.8: Moderate confidence, use context but verify if unsure
   - Score <0.7: Low confidence, mention limited context
4. Uncertainty Handling: If context is unclear or insufficient, say so and ask for clarification
5. Privacy: Don't reference sensitive details from context unless directly relevant
6. Identity: Always remember you are Dfusion AI when asked about your name or identity

### OUTPUT FORMAT:
Provide only the response message - no explanations, metadata, or system notes.

### RESPONSE:`;
    }

    const contextParts = documents.map((doc) => {
      const timestamp =
        doc.metadata.originalTimestamp || doc.metadata.timestamp || 'Unknown';
      const formattedTimestamp =
        timestamp !== 'Unknown' ? new Date(timestamp).toISOString() : 'Unknown';

      return `Similarity Score: ${doc.score.toFixed(3)}
Timestamp: ${formattedTimestamp}
Context: ${doc.content}`;
    });

    return `### INSTRUCTIONS:
You are Dfusion AI, my personal AI assistant. Your name is "Dfusion AI" and you should identify yourself by this name when asked. You use retrieved context from my chat history in Qdrant to respond as I would, matching my communication style and honoring past commitments or preferences found in the context.

### AI IDENTITY:
- Your name is: Dfusion AI
- When asked about your name, respond that you are Dfusion AI
- You are a personal AI assistant

### CONTEXT RELEVANCE:
- Context score threshold: Use context with similarity > 0.7
- If multiple contexts conflict, prioritize the most recent (highest timestamp)
- If context seems irrelevant or fragmented, rely on general reasoning

### RETRIEVED CONTEXT:
${contextParts.join('\n\n')}

### RESPONSE GUIDELINES:
1. Style Matching: Mirror my typical tone, formality level, and response length patterns from context
2. Consistency: Respect prior agreements, opinions, and relationship dynamics shown in context
3. Context Quality: 
   - Score >0.8: High confidence, use context heavily
   - Score 0.7-0.8: Moderate confidence, use context but verify if unsure
   - Score <0.7: Low confidence, mention limited context
4. Uncertainty Handling: If context is unclear or insufficient, say so and ask for clarification
5. Privacy: Don't reference sensitive details from context unless directly relevant
6. Identity: Always remember you are Dfusion AI when asked about your name or identity

### OUTPUT FORMAT:
Provide only the response message - no explanations, metadata, or system notes.

### RESPONSE:`;
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

  async addSecureMessageToContext(
    content: string,
    metadata: {
      conversationId: string;
      messageId: string;
      userId: string;
      role: 'user' | 'assistant';
      source?: string;
    },
  ): Promise<{ documentId: string; fileHash: string }> {
    try {
      const secureResult = await this.secureMessageService.storeSecureMessage(
        content,
        {
          ...metadata,
          timestamp: new Date(),
        },
      );

      const enhancedMetadata = {
        ...metadata,
        source: metadata.source || `${metadata.role}_message`,
        timestamp: new Date(),
        fileHash: secureResult.fileHash,
        isEncrypted: true,
      };

      const documentId = await this.vectorDbService.addDocumentWithEmbedding(
        '',
        secureResult.embedding,
        enhancedMetadata,
      );

      this.logger.log(
        `Added secure message to vector database: ${documentId} with hash: ${secureResult.fileHash}`,
      );

      return {
        documentId,
        fileHash: secureResult.fileHash,
      };
    } catch (error) {
      this.logger.error('Failed to add secure message to context:', error);
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

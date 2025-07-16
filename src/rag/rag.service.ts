import { Injectable, Logger } from '@nestjs/common';
import { VectorDbService, SearchResult } from '../vector-db/vector-db.service';

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

  constructor(private readonly vectorDbService: VectorDbService) {}

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

      const contextText = this.buildContextText(filteredResults);

      return {
        query,
        retrievedDocuments: filteredResults,
        contextText,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve RAG context:', error);
      throw error;
    }
  }

  private buildContextText(documents: SearchResult[]): string {
    if (documents.length === 0) {
      return '';
    }

    const contextParts = documents.map((doc, index) => {
      const source = doc.metadata.source || 'Unknown';
      const platform = doc.metadata.platform || '';
      const timestamp =
        doc.metadata.originalTimestamp || doc.metadata.timestamp;

      let sourceLabel = source;
      if (platform) {
        sourceLabel = `${platform.toUpperCase()} (${source})`;
      }

      let timeInfo = '';
      if (timestamp) {
        const date = new Date(timestamp);
        timeInfo = ` - ${date.toLocaleDateString()}`;
      }

      return `[CONTEXT ${index + 1}] Source: ${sourceLabel}${timeInfo}\nContent: ${doc.content}`;
    });

    return `## CONTEXT INFORMATION

You are an AI assistant with access to the user's personal data. Use the following context to answer questions accurately and helpfully.

${contextParts.join('\n\n')}

## INSTRUCTIONS

- Answer based on the provided context above
- If the context contains relevant information, use it to provide a specific answer
- If the context doesn't contain enough information, say so clearly
- Always reference which context source you're using
- Be helpful and conversational

## USER QUESTION`;
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
      return userMessage;
    }

    return `${ragContext.contextText}\n\n${userMessage}`;
  }

  async addMessageToContext(
    content: string,
    metadata: {
      conversationId: string;
      messageId: string;
      userId: string;
      role: 'user' | 'assistant';
      source?: string;
    },
  ): Promise<string> {
    try {
      const enhancedMetadata = {
        ...metadata,
        source: metadata.source || `${metadata.role}_message`,
        timestamp: new Date(),
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

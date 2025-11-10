/**
 * Interface for Context Manager
 */

import { Message, Context } from '../types.js';

export interface IContextManager {
  /**
   * Add a message to the context
   */
  addMessage(sessionId: string, message: Message): Promise<void>;

  /**
   * Get the current context with token limit
   */
  getContext(sessionId: string, maxTokens: number): Promise<Context>;

  /**
   * Compress context to fit within token limit
   */
  compressContext(sessionId: string, compressionRatio: number): Promise<void>;

  /**
   * Summarize long content
   */
  summarizeContent(content: string): Promise<string>;

  /**
   * Clear context for a session
   */
  clearContext(sessionId: string): Promise<void>;
}

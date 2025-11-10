/**
 * Interface for Context Manager with multi-turn support
 */

import { Message, Context } from '../types.js';
import { ToolExecutionRecord } from '../models/ContextModel.js';

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

  /**
   * Record a tool execution for multi-turn tracking
   */
  recordToolExecution(
    sessionId: string,
    toolName: string,
    parameters: Record<string, any>,
    success: boolean,
    output?: string
  ): Promise<void>;

  /**
   * Track a file mention in conversation
   */
  trackFileMention(sessionId: string, filePath: string): Promise<void>;

  /**
   * Get conversation focus (files currently being discussed)
   */
  getConversationFocus(sessionId: string): Promise<string[]>;

  /**
   * Get recent tool execution history
   */
  getRecentToolExecutions(sessionId: string): Promise<ToolExecutionRecord[]>;

  /**
   * Get context summary for the model
   */
  getContextSummary(sessionId: string): Promise<string>;

  /**
   * Clear conversation focus
   */
  clearFocus(sessionId: string): Promise<void>;

  /**
   * Get all mentioned files in the session
   */
  getMentionedFiles(sessionId: string): Promise<string[]>;
}

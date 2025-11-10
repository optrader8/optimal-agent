/**
 * Context Manager implementation
 */

import { IContextManager } from '../interfaces/IContextManager.js';
import { Message, Context } from '../types.js';
import { ContextModel } from '../models/ContextModel.js';

export class ContextManager implements IContextManager {
  private contexts: Map<string, ContextModel> = new Map();

  /**
   * Add a message to the context
   */
  async addMessage(sessionId: string, message: Message): Promise<void> {
    let context = this.contexts.get(sessionId);

    if (!context) {
      context = new ContextModel();
      this.contexts.set(sessionId, context);
    }

    context.addMessage(message);
  }

  /**
   * Get the current context with token limit
   */
  async getContext(sessionId: string, maxTokens: number): Promise<Context> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      return new ContextModel();
    }

    // Return context with recent messages within token limit
    const recentMessages = context.getRecentMessages(maxTokens);

    return {
      messages: recentMessages,
      currentFiles: context.currentFiles,
      workingDirectory: context.workingDirectory,
      sessionState: context.sessionState,
      tokenCount: recentMessages.reduce(
        (sum, msg) => sum + Math.ceil(msg.content.length / 4),
        0
      ),
    };
  }

  /**
   * Compress context to fit within token limit
   */
  async compressContext(
    sessionId: string,
    compressionRatio: number
  ): Promise<void> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      return;
    }

    // Simple compression: keep only the most recent messages
    const targetCount = Math.floor(context.messages.length * compressionRatio);
    context.messages = context.messages.slice(-targetCount);
  }

  /**
   * Summarize long content
   */
  async summarizeContent(content: string): Promise<string> {
    // Simple summarization: take first and last parts
    const lines = content.split('\n');

    if (lines.length <= 20) {
      return content;
    }

    const firstLines = lines.slice(0, 10).join('\n');
    const lastLines = lines.slice(-10).join('\n');

    return `${firstLines}\n\n... (${lines.length - 20} lines omitted) ...\n\n${lastLines}`;
  }

  /**
   * Clear context for a session
   */
  async clearContext(sessionId: string): Promise<void> {
    this.contexts.delete(sessionId);
  }
}

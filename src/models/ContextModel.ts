/**
 * Context data model
 */

import { Context as IContext, Message } from '../types.js';

export class ContextModel implements IContext {
  messages: Message[];
  currentFiles: string[];
  workingDirectory: string;
  sessionState: Record<string, any>;
  tokenCount: number;

  constructor(workingDirectory: string = process.cwd()) {
    this.messages = [];
    this.currentFiles = [];
    this.workingDirectory = workingDirectory;
    this.sessionState = {};
    this.tokenCount = 0;
  }

  /**
   * Add a message to context
   */
  addMessage(message: Message): void {
    this.messages.push(message);
    this.updateTokenCount();
  }

  /**
   * Update token count
   */
  private updateTokenCount(): void {
    this.tokenCount = this.messages.reduce((sum, msg) => {
      // Rough estimate: ~4 characters per token
      return sum + Math.ceil(msg.content.length / 4);
    }, 0);
  }

  /**
   * Get recent messages within token limit
   */
  getRecentMessages(maxTokens: number): Message[] {
    const result: Message[] = [];
    let currentTokens = 0;

    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      const msgTokens = Math.ceil(msg.content.length / 4);

      if (currentTokens + msgTokens > maxTokens) {
        break;
      }

      result.unshift(msg);
      currentTokens += msgTokens;
    }

    return result;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, any> {
    return {
      messages: this.messages,
      currentFiles: this.currentFiles,
      workingDirectory: this.workingDirectory,
      sessionState: this.sessionState,
      tokenCount: this.tokenCount,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json: Record<string, any>): ContextModel {
    const context = new ContextModel(json.workingDirectory || process.cwd());
    context.messages = json.messages || [];
    context.currentFiles = json.currentFiles || [];
    context.sessionState = json.sessionState || {};
    context.tokenCount = json.tokenCount || 0;
    return context;
  }
}

/**
 * Context data model with enhanced multi-turn conversation support
 */

import { Context as IContext, Message, ToolCall } from '../types.js';

export interface ToolExecutionRecord {
  toolName: string;
  timestamp: Date;
  parameters: Record<string, any>;
  success: boolean;
  output?: string;
}

export class ContextModel implements IContext {
  messages: Message[];
  currentFiles: string[];
  workingDirectory: string;
  sessionState: Record<string, any>;
  tokenCount: number;

  // Enhanced multi-turn tracking
  mentionedFiles: Set<string>;
  recentToolExecutions: ToolExecutionRecord[];
  conversationFocus: string[];
  lastToolResults: Map<string, string>;

  constructor(workingDirectory: string = process.cwd()) {
    this.messages = [];
    this.currentFiles = [];
    this.workingDirectory = workingDirectory;
    this.sessionState = {};
    this.tokenCount = 0;

    // Initialize multi-turn tracking
    this.mentionedFiles = new Set();
    this.recentToolExecutions = [];
    this.conversationFocus = [];
    this.lastToolResults = new Map();
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
    context.mentionedFiles = new Set(json.mentionedFiles || []);
    context.recentToolExecutions = json.recentToolExecutions || [];
    context.conversationFocus = json.conversationFocus || [];
    context.lastToolResults = new Map(Object.entries(json.lastToolResults || {}));
    return context;
  }

  /**
   * Track a file mention
   */
  trackFileMention(filePath: string): void {
    this.mentionedFiles.add(filePath);

    // Update conversation focus
    if (!this.conversationFocus.includes(filePath)) {
      this.conversationFocus.push(filePath);

      // Keep focus list manageable (max 5 files)
      if (this.conversationFocus.length > 5) {
        this.conversationFocus.shift();
      }
    }
  }

  /**
   * Record a tool execution
   */
  recordToolExecution(
    toolName: string,
    parameters: Record<string, any>,
    success: boolean,
    output?: string
  ): void {
    const record: ToolExecutionRecord = {
      toolName,
      timestamp: new Date(),
      parameters,
      success,
      output,
    };

    this.recentToolExecutions.push(record);

    // Keep only recent executions (last 20)
    if (this.recentToolExecutions.length > 20) {
      this.recentToolExecutions.shift();
    }

    // Track files involved in the tool execution
    const filePath = parameters.path || parameters.file_path || parameters.filePath;
    if (filePath && typeof filePath === 'string') {
      this.trackFileMention(filePath);
    }

    // Store last result for quick reference
    if (success && output) {
      this.lastToolResults.set(toolName, output);

      // Keep only last 10 tool results
      if (this.lastToolResults.size > 10) {
        const firstKey = this.lastToolResults.keys().next().value;
        if (firstKey) {
          this.lastToolResults.delete(firstKey);
        }
      }
    }
  }

  /**
   * Get conversation context summary for model
   */
  getContextSummary(): string {
    const parts: string[] = [];

    // Working directory
    parts.push(`Working directory: ${this.workingDirectory}`);

    // Files in focus
    if (this.conversationFocus.length > 0) {
      parts.push(`\nCurrently discussing: ${this.conversationFocus.join(', ')}`);
    }

    // Recent tool executions summary
    if (this.recentToolExecutions.length > 0) {
      const recentTools = this.recentToolExecutions
        .slice(-5)
        .map(r => `${r.toolName}(${Object.keys(r.parameters).join(', ')})`)
        .join(', ');
      parts.push(`\nRecent tools used: ${recentTools}`);
    }

    // All mentioned files
    if (this.mentionedFiles.size > 0) {
      const files = Array.from(this.mentionedFiles).slice(-10).join(', ');
      parts.push(`\nFiles mentioned in conversation: ${files}`);
    }

    return parts.join('\n');
  }

  /**
   * Clear conversation focus (when topic changes)
   */
  clearFocus(): void {
    this.conversationFocus = [];
  }
}

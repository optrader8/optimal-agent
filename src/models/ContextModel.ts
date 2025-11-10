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

  // Working set management (9.3)
  workingSet: Map<string, { accessCount: number; lastAccess: Date }>;
  fileCache: Map<string, { content: string; timestamp: Date }>;

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

    // Initialize working set management
    this.workingSet = new Map();
    this.fileCache = new Map();
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
  updateTokenCount(): void {
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
      mentionedFiles: Array.from(this.mentionedFiles),
      recentToolExecutions: this.recentToolExecutions,
      conversationFocus: this.conversationFocus,
      lastToolResults: Object.fromEntries(this.lastToolResults),
      workingSet: Array.from(this.workingSet.entries()).map(([path, data]) => ({
        path,
        accessCount: data.accessCount,
        lastAccess: data.lastAccess.toISOString(),
      })),
      fileCache: Array.from(this.fileCache.entries()).map(([path, data]) => ({
        path,
        content: data.content,
        timestamp: data.timestamp.toISOString(),
      })),
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

    // Restore working set
    if (json.workingSet) {
      context.workingSet = new Map(
        json.workingSet.map((item: any) => [
          item.path,
          {
            accessCount: item.accessCount,
            lastAccess: new Date(item.lastAccess),
          },
        ])
      );
    }

    // Restore file cache
    if (json.fileCache) {
      context.fileCache = new Map(
        json.fileCache.map((item: any) => [
          item.path,
          {
            content: item.content,
            timestamp: new Date(item.timestamp),
          },
        ])
      );
    }

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

  /**
   * Track file access in working set
   */
  trackFileAccess(filePath: string): void {
    const existing = this.workingSet.get(filePath);
    if (existing) {
      existing.accessCount++;
      existing.lastAccess = new Date();
    } else {
      this.workingSet.set(filePath, {
        accessCount: 1,
        lastAccess: new Date(),
      });
    }

    // Keep working set manageable (top 20 most accessed files)
    if (this.workingSet.size > 20) {
      // Remove least recently accessed file
      let leastRecent: string | null = null;
      let leastRecentTime = new Date();

      for (const [path, data] of this.workingSet.entries()) {
        if (data.lastAccess < leastRecentTime) {
          leastRecentTime = data.lastAccess;
          leastRecent = path;
        }
      }

      if (leastRecent) {
        this.workingSet.delete(leastRecent);
        this.fileCache.delete(leastRecent);
      }
    }
  }

  /**
   * Get working set (frequently accessed files)
   */
  getWorkingSet(): Array<{ path: string; accessCount: number; lastAccess: Date }> {
    return Array.from(this.workingSet.entries())
      .map(([path, data]) => ({ path, ...data }))
      .sort((a, b) => b.accessCount - a.accessCount);
  }

  /**
   * Cache file content
   */
  cacheFile(filePath: string, content: string): void {
    this.fileCache.set(filePath, {
      content,
      timestamp: new Date(),
    });

    // Keep cache size manageable (max 10 files)
    if (this.fileCache.size > 10) {
      const oldest = Array.from(this.fileCache.entries())
        .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime())[0];

      if (oldest) {
        this.fileCache.delete(oldest[0]);
      }
    }
  }

  /**
   * Get cached file content if available and recent
   */
  getCachedFile(filePath: string, maxAgeMs: number = 60000): string | null {
    const cached = this.fileCache.get(filePath);
    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp.getTime();
    if (age > maxAgeMs) {
      this.fileCache.delete(filePath);
      return null;
    }

    return cached.content;
  }

  /**
   * Clear file cache
   */
  clearFileCache(): void {
    this.fileCache.clear();
  }
}

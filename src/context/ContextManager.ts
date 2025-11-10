/**
 * Context Manager implementation with enhanced multi-turn support
 */

import { IContextManager } from '../interfaces/IContextManager.js';
import { Message, Context } from '../types.js';
import { ContextModel, ToolExecutionRecord } from '../models/ContextModel.js';
import { ImportanceScorer } from '../utils/importance-scorer.js';
import fs from 'fs/promises';
import path from 'path';

export class ContextManager implements IContextManager {
  private contexts: Map<string, ContextModel> = new Map();
  private sessionsDir: string;
  private importanceScorer: ImportanceScorer;

  constructor(sessionsDir: string = './.sessions') {
    this.sessionsDir = sessionsDir;
    this.importanceScorer = new ImportanceScorer();
    this.ensureSessionsDir();
  }

  /**
   * Ensure sessions directory exists
   */
  private async ensureSessionsDir(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create sessions directory:', error);
    }
  }

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
   * Compress context to fit within token limit using importance scoring
   */
  async compressContext(
    sessionId: string,
    compressionRatio: number
  ): Promise<void> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      return;
    }

    // Score all messages by importance
    const totalMessages = context.messages.length;
    const scoredMessages = context.messages.map((msg, idx) => {
      const score = this.importanceScorer.scoreMessage(msg, {
        position: idx / Math.max(totalMessages - 1, 1),
        totalMessages,
        hasToolCalls: msg.content.includes('[Tool:') || msg.content.includes('read_file') || msg.content.includes('write_file'),
        toolCallResults: msg.role === 'assistant' ? [msg.content] : undefined,
      });

      return { message: msg, score: score.score };
    });

    // Target token count based on compression ratio
    const currentTokens = context.tokenCount;
    const targetTokens = Math.floor(currentTokens * compressionRatio);

    // Select most important messages within token budget
    const selected = this.importanceScorer.selectImportantMessages(
      scoredMessages,
      targetTokens
    );

    context.messages = selected;
    context.updateTokenCount();
  }

  /**
   * Intelligent context compression with priority-based selection
   */
  async compressContextIntelligent(
    sessionId: string,
    maxTokens: number
  ): Promise<void> {
    const context = this.contexts.get(sessionId);

    if (!context || context.tokenCount <= maxTokens) {
      return;
    }

    const compressionRatio = maxTokens / context.tokenCount;
    await this.compressContext(sessionId, compressionRatio);
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

  /**
   * Record a tool execution for multi-turn tracking
   */
  async recordToolExecution(
    sessionId: string,
    toolName: string,
    parameters: Record<string, any>,
    success: boolean,
    output?: string
  ): Promise<void> {
    const context = this.contexts.get(sessionId);

    if (context) {
      context.recordToolExecution(toolName, parameters, success, output);
    }
  }

  /**
   * Track a file mention in conversation
   */
  async trackFileMention(sessionId: string, filePath: string): Promise<void> {
    const context = this.contexts.get(sessionId);

    if (context) {
      context.trackFileMention(filePath);
    }
  }

  /**
   * Get conversation focus (files currently being discussed)
   */
  async getConversationFocus(sessionId: string): Promise<string[]> {
    const context = this.contexts.get(sessionId);
    return context?.conversationFocus || [];
  }

  /**
   * Get recent tool execution history
   */
  async getRecentToolExecutions(sessionId: string): Promise<ToolExecutionRecord[]> {
    const context = this.contexts.get(sessionId);
    return context?.recentToolExecutions || [];
  }

  /**
   * Get context summary for the model
   */
  async getContextSummary(sessionId: string): Promise<string> {
    const context = this.contexts.get(sessionId);
    return context?.getContextSummary() || '';
  }

  /**
   * Clear conversation focus
   */
  async clearFocus(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);

    if (context) {
      context.clearFocus();
    }
  }

  /**
   * Get all mentioned files in the session
   */
  async getMentionedFiles(sessionId: string): Promise<string[]> {
    const context = this.contexts.get(sessionId);
    return context ? Array.from(context.mentionedFiles) : [];
  }

  /**
   * Save session to disk for persistence
   */
  async saveSession(sessionId: string): Promise<boolean> {
    const context = this.contexts.get(sessionId);
    if (!context) {
      return false;
    }

    try {
      await this.ensureSessionsDir();

      const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
      const sessionData = {
        sessionId,
        timestamp: new Date().toISOString(),
        context: context.toJSON(),
      };

      await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error(`Failed to save session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Load session from disk
   */
  async loadSession(sessionId: string): Promise<boolean> {
    try {
      const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
      const data = await fs.readFile(sessionFile, 'utf-8');
      const sessionData = JSON.parse(data);

      const context = ContextModel.fromJSON(sessionData.context);
      this.contexts.set(sessionId, context);

      return true;
    } catch (error) {
      console.error(`Failed to load session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * List all saved sessions
   */
  async listSessions(): Promise<Array<{ sessionId: string; timestamp: string }>> {
    try {
      await this.ensureSessionsDir();
      const files = await fs.readdir(this.sessionsDir);
      const sessions = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readFile(path.join(this.sessionsDir, file), 'utf-8');
            const sessionData = JSON.parse(data);
            sessions.push({
              sessionId: sessionData.sessionId,
              timestamp: sessionData.timestamp,
            });
          } catch (error) {
            // Skip invalid session files
            continue;
          }
        }
      }

      return sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (error) {
      console.error('Failed to list sessions:', error);
      return [];
    }
  }

  /**
   * Delete saved session file
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
      await fs.unlink(sessionFile);
      return true;
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error);
      return false;
    }
  }
}

/**
 * Context-based Parameter Inference
 * Infers missing parameters from conversation context
 */

import { ToolCall } from '../types.js';

export interface ConversationContext {
  messages: Array<{ role: string; content: string }>;
  lastFiles: string[];
  lastDirectories: string[];
  lastSearchPatterns: string[];
  lastVariables: Map<string, any>;
}

export class ContextInference {
  /**
   * Infer missing parameters from context
   */
  inferParameters(
    toolCall: ToolCall,
    context: ConversationContext
  ): ToolCall {
    const params = { ...toolCall.parameters };

    // Infer file path if missing
    if (!params.path && this.needsFilePath(toolCall.toolName)) {
      const inferredPath = this.inferFilePath(context);
      if (inferredPath) {
        params.path = inferredPath;
        toolCall.parameters = params;
      }
    }

    // Infer directory if missing
    if (!params.directory && this.needsDirectory(toolCall.toolName)) {
      const inferredDir = this.inferDirectory(context);
      if (inferredDir) {
        params.directory = inferredDir;
        toolCall.parameters = params;
      }
    }

    // Infer search pattern if missing
    if (!params.pattern && toolCall.toolName === 'grep_search') {
      const inferredPattern = this.inferSearchPattern(context);
      if (inferredPattern) {
        params.pattern = inferredPattern;
        toolCall.parameters = params;
      }
    }

    return toolCall;
  }

  /**
   * Infer file path from context
   */
  private inferFilePath(context: ConversationContext): string | null {
    // Get last mentioned files
    if (context.lastFiles.length > 0) {
      return context.lastFiles[context.lastFiles.length - 1];
    }

    // Extract file paths from recent messages
    const recentMessages = context.messages.slice(-5);
    for (const msg of recentMessages.reverse()) {
      const match = msg.content.match(/(['"`]([^'"`]+\.\w+)['"`])/);
      if (match) {
        return match[2];
      }
    }

    return null;
  }

  /**
   * Infer directory from context
   */
  private inferDirectory(context: ConversationContext): string | null {
    if (context.lastDirectories.length > 0) {
      return context.lastDirectories[context.lastDirectories.length - 1];
    }

    // Extract directory paths from recent messages
    const recentMessages = context.messages.slice(-5);
    for (const msg of recentMessages.reverse()) {
      const match = msg.content.match(/(['"`]([^'"`]+\/[^'"`]+)['"`])/);
      if (match && !match[2].includes('.')) {
        return match[2];
      }
    }

    return '.'; // Default to current directory
  }

  /**
   * Infer search pattern from context
   */
  private inferSearchPattern(context: ConversationContext): string | null {
    if (context.lastSearchPatterns.length > 0) {
      return context.lastSearchPatterns[context.lastSearchPatterns.length - 1];
    }

    return null;
  }

  /**
   * Check if tool needs file path
   */
  private needsFilePath(toolName: string): boolean {
    return [
      'read_file',
      'write_file',
      'edit_file',
      'file_stat',
      'get_file_outline',
    ].includes(toolName);
  }

  /**
   * Check if tool needs directory
   */
  private needsDirectory(toolName: string): boolean {
    return [
      'list_directory',
      'file_tree',
      'find',
      'find_symbol',
    ].includes(toolName);
  }

  /**
   * Extract file references from text
   */
  extractFileReferences(text: string): string[] {
    const files: string[] = [];

    // Match quoted file paths
    const quotedMatches = text.matchAll(/(['"`])([^'"`]+\.\w+)\1/g);
    for (const match of quotedMatches) {
      files.push(match[2]);
    }

    // Match unquoted file paths (with extensions)
    const unquotedMatches = text.matchAll(/\b([\w\-./]+\.\w+)\b/g);
    for (const match of unquotedMatches) {
      if (!match[1].startsWith('http')) {
        files.push(match[1]);
      }
    }

    return files;
  }

  /**
   * Extract directory references from text
   */
  extractDirectoryReferences(text: string): string[] {
    const dirs: string[] = [];

    // Match quoted directory paths
    const quotedMatches = text.matchAll(/(['"`])([^'"`]+\/[^'"`]*)\1/g);
    for (const match of quotedMatches) {
      if (!match[2].includes('.') || match[2].endsWith('/')) {
        dirs.push(match[2]);
      }
    }

    // Common directory references
    const dirPatterns = [
      /(?:디렉토리|폴더|경로)\s+(['"`]?([^'"`\s]+)['"`]?)/,
      /(?:in|from|under)\s+(['"`]?([^'"`\s]+)['"`]?)\s+(?:directory|folder)/,
    ];

    for (const pattern of dirPatterns) {
      const match = text.match(pattern);
      if (match) {
        dirs.push(match[2].replace(/['""`]/g, ''));
      }
    }

    return dirs;
  }

  /**
   * Extract search patterns from text
   */
  extractSearchPatterns(text: string): string[] {
    const patterns: string[] = [];

    // Match quoted patterns
    const quotedMatches = text.matchAll(/(['"`])([^'"`]+)\1/g);
    for (const match of quotedMatches) {
      // Exclude file paths and directory paths
      if (!match[2].includes('/') && !match[2].match(/\.\w+$/)) {
        patterns.push(match[2]);
      }
    }

    return patterns;
  }

  /**
   * Update context with new information
   */
  updateContext(
    context: ConversationContext,
    message: string,
    toolCall?: ToolCall
  ): ConversationContext {
    // Extract references from message
    const files = this.extractFileReferences(message);
    const dirs = this.extractDirectoryReferences(message);
    const patterns = this.extractSearchPatterns(message);

    // Update context
    context.lastFiles.push(...files);
    context.lastDirectories.push(...dirs);
    context.lastSearchPatterns.push(...patterns);

    // Update from tool call parameters
    if (toolCall) {
      if (toolCall.parameters.path) {
        context.lastFiles.push(toolCall.parameters.path);
      }
      if (toolCall.parameters.directory) {
        context.lastDirectories.push(toolCall.parameters.directory);
      }
      if (toolCall.parameters.pattern) {
        context.lastSearchPatterns.push(toolCall.parameters.pattern);
      }
    }

    // Keep only recent items (last 10)
    context.lastFiles = context.lastFiles.slice(-10);
    context.lastDirectories = context.lastDirectories.slice(-10);
    context.lastSearchPatterns = context.lastSearchPatterns.slice(-10);

    return context;
  }

  /**
   * Create new context
   */
  createContext(): ConversationContext {
    return {
      messages: [],
      lastFiles: [],
      lastDirectories: [],
      lastSearchPatterns: [],
      lastVariables: new Map(),
    };
  }
}

// Global context inference instance
export const globalContextInference = new ContextInference();

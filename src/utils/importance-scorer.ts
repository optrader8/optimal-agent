/**
 * Importance Scorer for Context Compression
 * Scores messages and content based on importance for intelligent summarization
 */

import { Message, ToolCall } from '../types.js';

export interface ImportanceScore {
  score: number; // 0-100
  reasons: string[];
}

export class ImportanceScorer {
  /**
   * Score a message based on various importance factors
   */
  scoreMessage(message: Message, context: {
    position: number; // position in conversation (0 = oldest, 1 = newest)
    totalMessages: number;
    hasToolCalls: boolean;
    toolCallResults?: string[];
  }): ImportanceScore {
    let score = 0;
    const reasons: string[] = [];

    // Base score for all messages
    score += 10;

    // Recent messages are more important (recency bias)
    const recencyScore = context.position * 30;
    if (recencyScore > 0) {
      score += recencyScore;
      reasons.push(`Recent message (+${Math.round(recencyScore)})`);
    }

    // System messages are important
    if (message.role === 'system') {
      score += 20;
      reasons.push('System message (+20)');
    }

    // Messages with tool calls are important
    if (context.hasToolCalls) {
      score += 25;
      reasons.push('Contains tool calls (+25)');
    }

    // Messages with successful tool results are very important
    if (context.toolCallResults && context.toolCallResults.length > 0) {
      score += 15;
      reasons.push('Has tool results (+15)');
    }

    // Longer messages might be more important (up to a point)
    const lengthScore = Math.min(message.content.length / 100, 10);
    if (lengthScore > 5) {
      score += lengthScore;
      reasons.push(`Substantial content (+${Math.round(lengthScore)})`);
    }

    // Messages with code blocks are important
    if (message.content.includes('```')) {
      score += 15;
      reasons.push('Contains code block (+15)');
    }

    // Messages with file paths are important
    const filePathPattern = /[a-zA-Z0-9_\-./]+\.(ts|js|json|md|txt|py|java|go|rs)/gi;
    const fileMatches = message.content.match(filePathPattern);
    if (fileMatches && fileMatches.length > 0) {
      const pathScore = Math.min(fileMatches.length * 5, 15);
      score += pathScore;
      reasons.push(`References ${fileMatches.length} files (+${pathScore})`);
    }

    // Messages with errors are important
    if (message.content.toLowerCase().includes('error') ||
        message.content.toLowerCase().includes('failed') ||
        message.content.toLowerCase().includes('exception')) {
      score += 10;
      reasons.push('Contains error information (+10)');
    }

    // Cap score at 100
    score = Math.min(score, 100);

    return { score, reasons };
  }

  /**
   * Score content for summarization priority
   */
  scoreContent(content: string): number {
    let score = 0;

    // Length factor
    const lines = content.split('\n').length;
    if (lines > 100) {
      score += 30; // Long content needs summarization
    } else if (lines > 50) {
      score += 20;
    } else if (lines > 20) {
      score += 10;
    }

    // Code content
    if (content.includes('function ') || content.includes('class ') || content.includes('const ')) {
      score += 20;
    }

    // Structured data (JSON, etc)
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      score += 15;
    }

    return Math.min(score, 100);
  }

  /**
   * Select most important messages based on token budget
   */
  selectImportantMessages(
    messages: Array<{ message: Message; score: number }>,
    maxTokens: number
  ): Message[] {
    // Sort by score (highest first)
    const sorted = [...messages].sort((a, b) => b.score - a.score);

    const selected: Message[] = [];
    let tokenCount = 0;

    // Always include system message if present
    const systemMsg = sorted.find(m => m.message.role === 'system');
    if (systemMsg) {
      selected.push(systemMsg.message);
      tokenCount += Math.ceil(systemMsg.message.content.length / 4);
    }

    // Add messages by importance until token limit
    for (const item of sorted) {
      if (item.message.role === 'system') continue; // Already added

      const msgTokens = Math.ceil(item.message.content.length / 4);
      if (tokenCount + msgTokens <= maxTokens) {
        selected.push(item.message);
        tokenCount += msgTokens;
      }
    }

    // Sort selected messages chronologically
    return selected.sort((a, b) => {
      const aIdx = messages.findIndex(m => m.message === a);
      const bIdx = messages.findIndex(m => m.message === b);
      return aIdx - bIdx;
    });
  }
}

/**
 * Error Handler with retry mechanisms and recovery strategies
 */

import {
  OptimalAgentError,
  ErrorCategory,
  ErrorSeverity,
  ErrorDetails,
  ValidationError,
  FileOperationError,
  ModelError,
  ToolExecutionError,
  NetworkError,
  ParsingError,
  ContextError,
  SystemError,
} from './ErrorTypes.js';
import fs from 'fs/promises';
import path from 'path';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  exponentialBackoff: boolean;
}

export interface ErrorLog {
  timestamp: Date;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  recovered: boolean;
  retryCount?: number;
}

export class ErrorHandler {
  private errorLogs: ErrorLog[] = [];
  private errorPatterns: Map<string, number> = new Map();
  private logFile: string;

  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    exponentialBackoff: true,
  };

  constructor(logFile: string = './logs/error.log') {
    this.logFile = logFile;
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      const dir = path.dirname(this.logFile);
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Handle error with automatic retry
   */
  async handleWithRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>,
    context?: Record<string, any>
  ): Promise<T> {
    const retryConfig = { ...this.defaultRetryConfig, ...config };
    let lastError: Error | null = null;
    let currentDelay = retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        if (error instanceof OptimalAgentError && !error.retryable) {
          throw error;
        }

        // Last attempt failed
        if (attempt === retryConfig.maxRetries) {
          await this.logError(error, context, attempt);
          throw error;
        }

        // Wait before retry
        console.log(`Retry attempt ${attempt + 1}/${retryConfig.maxRetries} after ${currentDelay}ms`);
        await this.delay(currentDelay);

        // Calculate next delay with exponential backoff
        if (retryConfig.exponentialBackoff) {
          currentDelay = Math.min(currentDelay * 2, retryConfig.maxDelayMs);
        }
      }
    }

    throw lastError;
  }

  /**
   * Categorize and wrap raw errors
   */
  categorizeError(error: any, context?: Record<string, any>): OptimalAgentError {
    if (error instanceof OptimalAgentError) {
      return error;
    }

    const message = error.message || String(error);

    // Network errors
    if (message.includes('ECONNREFUSED') ||
        message.includes('ETIMEDOUT') ||
        message.includes('ENOTFOUND') ||
        message.includes('fetch failed')) {
      return new NetworkError(message, error, context);
    }

    // File operation errors
    if (message.includes('ENOENT') ||
        message.includes('EACCES') ||
        message.includes('EPERM') ||
        message.includes('no such file')) {
      return new FileOperationError(message, error, context);
    }

    // Model errors
    if (message.includes('model') ||
        message.includes('API') ||
        message.includes('completion')) {
      return new ModelError(message, error, context);
    }

    // Tool execution errors
    if (message.includes('command') ||
        message.includes('execution') ||
        message.includes('spawn')) {
      return new ToolExecutionError(message, error, context);
    }

    // Default to system error
    return new SystemError(message, error, context);
  }

  /**
   * Log error to file and memory
   */
  async logError(
    error: any,
    context?: Record<string, any>,
    retryCount?: number
  ): Promise<void> {
    const categorizedError = this.categorizeError(error, context);

    const errorLog: ErrorLog = {
      timestamp: new Date(),
      category: categorizedError.category,
      severity: categorizedError.severity,
      message: categorizedError.message,
      stack: categorizedError.stack,
      context: context || categorizedError.details.context,
      recovered: false,
      retryCount,
    };

    // Store in memory
    this.errorLogs.push(errorLog);

    // Keep only last 100 errors in memory
    if (this.errorLogs.length > 100) {
      this.errorLogs.shift();
    }

    // Track error patterns
    const pattern = this.extractErrorPattern(categorizedError.message);
    this.errorPatterns.set(pattern, (this.errorPatterns.get(pattern) || 0) + 1);

    // Write to log file
    await this.writeToLogFile(errorLog);
  }

  /**
   * Write error to log file
   */
  private async writeToLogFile(errorLog: ErrorLog): Promise<void> {
    try {
      const logEntry = JSON.stringify({
        ...errorLog,
        timestamp: errorLog.timestamp.toISOString(),
      }) + '\n';

      await fs.appendFile(this.logFile, logEntry, 'utf-8');
    } catch (error) {
      console.error('Failed to write to error log file:', error);
    }
  }

  /**
   * Extract error pattern for analysis
   */
  private extractErrorPattern(message: string): string {
    // Remove specific details like paths, numbers, etc.
    return message
      .replace(/['"`][^'"`]+['"`]/g, '<PATH>')
      .replace(/\d+/g, '<NUM>')
      .replace(/line \d+/g, 'line <NUM>')
      .toLowerCase()
      .substring(0, 100);
  }

  /**
   * Get error recovery suggestions
   */
  getRecoverySuggestions(error: OptimalAgentError): string[] {
    const suggestions: string[] = [];

    if (error.details.suggestedAction) {
      suggestions.push(error.details.suggestedAction);
    }

    // Category-specific suggestions
    switch (error.category) {
      case ErrorCategory.FILE_OPERATION:
        suggestions.push('Verify the file path exists');
        suggestions.push('Check file permissions (read/write access)');
        suggestions.push('Ensure sufficient disk space');
        break;

      case ErrorCategory.NETWORK:
        suggestions.push('Check your internet connection');
        suggestions.push('Verify the API endpoint is accessible');
        suggestions.push('Check for firewall or proxy issues');
        break;

      case ErrorCategory.MODEL:
        suggestions.push('Ensure the model is loaded and running');
        suggestions.push('Check model configuration in .env file');
        suggestions.push('Verify API credentials are correct');
        break;

      case ErrorCategory.TOOL_EXECUTION:
        suggestions.push('Review the tool parameters');
        suggestions.push('Check if required dependencies are installed');
        suggestions.push('Verify the command syntax is correct');
        break;

      case ErrorCategory.PARSING:
        suggestions.push('Rephrase your request more clearly');
        suggestions.push('Use explicit tool names when possible');
        suggestions.push('Break complex requests into simpler steps');
        break;

      case ErrorCategory.CONTEXT:
        suggestions.push('Try clearing the conversation context');
        suggestions.push('Start a new session');
        suggestions.push('Reduce the context window size');
        break;
    }

    return suggestions;
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    topPatterns: Array<{ pattern: string; count: number }>;
  } {
    const stats = {
      total: this.errorLogs.length,
      byCategory: {} as Record<ErrorCategory, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      topPatterns: [] as Array<{ pattern: string; count: number }>,
    };

    // Count by category and severity
    for (const log of this.errorLogs) {
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
    }

    // Top error patterns
    stats.topPatterns = Array.from(this.errorPatterns.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 10): ErrorLog[] {
    return this.errorLogs.slice(-limit);
  }

  /**
   * Clear error logs
   */
  clearLogs(): void {
    this.errorLogs = [];
    this.errorPatterns.clear();
  }

  /**
   * Utility: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format error for user display
   */
  formatUserError(error: any): string {
    const categorizedError = this.categorizeError(error);
    const suggestions = this.getRecoverySuggestions(categorizedError);

    let output = `❌ Error: ${categorizedError.message}\n`;
    output += `Category: ${categorizedError.category}\n`;
    output += `Severity: ${categorizedError.severity}\n`;

    if (suggestions.length > 0) {
      output += '\nSuggested actions:\n';
      suggestions.forEach((suggestion, idx) => {
        output += `${idx + 1}. ${suggestion}\n`;
      });
    }

    return output;
  }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler();

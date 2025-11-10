/**
 * Error Types and Categories
 */

export enum ErrorCategory {
  VALIDATION = 'validation',
  FILE_OPERATION = 'file_operation',
  MODEL = 'model',
  TOOL_EXECUTION = 'tool_execution',
  NETWORK = 'network',
  PARSING = 'parsing',
  CONTEXT = 'context',
  SYSTEM = 'system',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorDetails {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  context?: Record<string, any>;
  timestamp: Date;
  stack?: string;
  retryable: boolean;
  suggestedAction?: string;
}

export class OptimalAgentError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly details: ErrorDetails;
  public readonly retryable: boolean;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = 'OptimalAgentError';
    this.category = details.category;
    this.severity = details.severity;
    this.details = details;
    this.retryable = details.retryable;

    // Maintain proper stack trace
    if (details.originalError?.stack) {
      this.stack = details.originalError.stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends OptimalAgentError {
  constructor(message: string, context?: Record<string, any>) {
    super({
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      message,
      context,
      timestamp: new Date(),
      retryable: false,
      suggestedAction: 'Check input parameters and try again',
    });
    this.name = 'ValidationError';
  }
}

export class FileOperationError extends OptimalAgentError {
  constructor(message: string, originalError?: Error, context?: Record<string, any>) {
    super({
      category: ErrorCategory.FILE_OPERATION,
      severity: ErrorSeverity.MEDIUM,
      message,
      originalError,
      context,
      timestamp: new Date(),
      retryable: true,
      suggestedAction: 'Check file permissions and path, then retry',
    });
    this.name = 'FileOperationError';
  }
}

export class ModelError extends OptimalAgentError {
  constructor(message: string, originalError?: Error, context?: Record<string, any>) {
    super({
      category: ErrorCategory.MODEL,
      severity: ErrorSeverity.HIGH,
      message,
      originalError,
      context,
      timestamp: new Date(),
      retryable: true,
      suggestedAction: 'Check model connection and configuration',
    });
    this.name = 'ModelError';
  }
}

export class ToolExecutionError extends OptimalAgentError {
  constructor(message: string, originalError?: Error, context?: Record<string, any>) {
    super({
      category: ErrorCategory.TOOL_EXECUTION,
      severity: ErrorSeverity.MEDIUM,
      message,
      originalError,
      context,
      timestamp: new Date(),
      retryable: true,
      suggestedAction: 'Review tool parameters and retry',
    });
    this.name = 'ToolExecutionError';
  }
}

export class NetworkError extends OptimalAgentError {
  constructor(message: string, originalError?: Error, context?: Record<string, any>) {
    super({
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      message,
      originalError,
      context,
      timestamp: new Date(),
      retryable: true,
      suggestedAction: 'Check network connection and retry',
    });
    this.name = 'NetworkError';
  }
}

export class ParsingError extends OptimalAgentError {
  constructor(message: string, context?: Record<string, any>) {
    super({
      category: ErrorCategory.PARSING,
      severity: ErrorSeverity.LOW,
      message,
      context,
      timestamp: new Date(),
      retryable: false,
      suggestedAction: 'Rephrase your request more clearly',
    });
    this.name = 'ParsingError';
  }
}

export class ContextError extends OptimalAgentError {
  constructor(message: string, originalError?: Error, context?: Record<string, any>) {
    super({
      category: ErrorCategory.CONTEXT,
      severity: ErrorSeverity.MEDIUM,
      message,
      originalError,
      context,
      timestamp: new Date(),
      retryable: true,
      suggestedAction: 'Try clearing context or starting a new session',
    });
    this.name = 'ContextError';
  }
}

export class SystemError extends OptimalAgentError {
  constructor(message: string, originalError?: Error, context?: Record<string, any>) {
    super({
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
      message,
      originalError,
      context,
      timestamp: new Date(),
      retryable: false,
      suggestedAction: 'Check system logs and contact support if issue persists',
    });
    this.name = 'SystemError';
  }
}

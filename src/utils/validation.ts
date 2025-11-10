/**
 * Validation utilities
 */

import { ValidationResult, ToolCall } from '../types.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Validate a file path
 */
export function validateFilePath(filePath: string): ValidationResult {
  const errors: string[] = [];

  // Check for null or empty
  if (!filePath || filePath.trim() === '') {
    errors.push('File path cannot be empty');
    return { valid: false, errors };
  }

  // Check for path traversal attempts
  const normalized = path.normalize(filePath);
  if (normalized.includes('..')) {
    errors.push('Path traversal is not allowed');
  }

  // Check for absolute paths outside working directory
  if (path.isAbsolute(filePath)) {
    const cwd = process.cwd();
    if (!normalized.startsWith(cwd)) {
      errors.push('Absolute paths outside working directory are not allowed');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a shell command
 */
export function validateCommand(command: string): ValidationResult {
  const errors: string[] = [];

  // Check for null or empty
  if (!command || command.trim() === '') {
    errors.push('Command cannot be empty');
    return { valid: false, errors };
  }

  // Blacklist dangerous commands
  const dangerousCommands = ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'];
  for (const dangerous of dangerousCommands) {
    if (command.includes(dangerous)) {
      errors.push(`Dangerous command detected: ${dangerous}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate tool call parameters
 */
export function validateToolCall(
  toolCall: ToolCall,
  availableTools: string[]
): ValidationResult {
  const errors: string[] = [];

  // Check if tool exists
  if (!availableTools.includes(toolCall.toolName)) {
    errors.push(`Unknown tool: ${toolCall.toolName}`);
  }

  // Check confidence
  if (toolCall.confidence < 0 || toolCall.confidence > 1) {
    errors.push('Confidence must be between 0 and 1');
  }

  // Validate parameters based on tool type
  switch (toolCall.toolName) {
    case 'read_file':
    case 'write_file':
    case 'list_directory':
      if (!toolCall.parameters.path) {
        errors.push('Path parameter is required');
      } else {
        const pathValidation = validateFilePath(toolCall.parameters.path);
        errors.push(...pathValidation.errors);
      }
      break;

    case 'run_command':
      if (!toolCall.parameters.command) {
        errors.push('Command parameter is required');
      } else {
        const cmdValidation = validateCommand(toolCall.parameters.command);
        errors.push(...cmdValidation.errors);
      }
      break;

    case 'grep_search':
      if (!toolCall.parameters.pattern) {
        errors.push('Pattern parameter is required');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize file path
 */
export function sanitizeFilePath(filePath: string): string {
  // Normalize and resolve to absolute path
  const normalized = path.normalize(filePath);
  const resolved = path.isAbsolute(normalized)
    ? normalized
    : path.resolve(process.cwd(), normalized);

  return resolved;
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Validate model configuration
 */
export function validateModelConfig(config: any): ValidationResult {
  const errors: string[] = [];

  if (!config.modelName || typeof config.modelName !== 'string') {
    errors.push('Model name must be a non-empty string');
  }

  if (
    !config.maxTokens ||
    typeof config.maxTokens !== 'number' ||
    config.maxTokens <= 0
  ) {
    errors.push('Max tokens must be a positive number');
  }

  if (
    config.temperature !== undefined &&
    (typeof config.temperature !== 'number' ||
      config.temperature < 0 ||
      config.temperature > 2)
  ) {
    errors.push('Temperature must be a number between 0 and 2');
  }

  if (
    !config.contextWindow ||
    typeof config.contextWindow !== 'number' ||
    config.contextWindow <= 0
  ) {
    errors.push('Context window must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

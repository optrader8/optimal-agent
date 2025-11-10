/**
 * Interface for Natural Language Parser
 */

import { ToolCall, ValidationResult } from '../types.js';

export interface IParser {
  /**
   * Parse tool calls from natural language text
   */
  parseToolCalls(text: string): ToolCall[];

  /**
   * Extract parameters for a specific tool type
   */
  extractParameters(text: string, toolType: string): Record<string, any>;

  /**
   * Validate a parsed tool call
   */
  validateToolCall(toolCall: ToolCall): ValidationResult;
}

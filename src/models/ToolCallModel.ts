/**
 * ToolCall data model
 */

import { ToolCall as IToolCall } from '../types.js';

export class ToolCallModel implements IToolCall {
  toolName: string;
  parameters: Record<string, any>;
  confidence: number;
  sourceText: string;

  constructor(
    toolName: string,
    parameters: Record<string, any>,
    confidence: number,
    sourceText: string
  ) {
    this.toolName = toolName;
    this.parameters = parameters;
    this.confidence = confidence;
    this.sourceText = sourceText;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, any> {
    return {
      toolName: this.toolName,
      parameters: this.parameters,
      confidence: this.confidence,
      sourceText: this.sourceText,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json: Record<string, any>): ToolCallModel {
    return new ToolCallModel(
      json.toolName,
      json.parameters || {},
      json.confidence || 0,
      json.sourceText || ''
    );
  }

  /**
   * Check if confidence is above threshold
   */
  isConfident(threshold: number = 0.7): boolean {
    return this.confidence >= threshold;
  }
}

/**
 * Interface for individual tools
 */

import { ToolResult } from '../types.js';

export interface ITool {
  /**
   * Tool name
   */
  name: string;

  /**
   * Tool description
   */
  description: string;

  /**
   * Tool parameters schema
   */
  parameters: Record<string, ToolParameter>;

  /**
   * Execute the tool
   */
  execute(params: Record<string, any>): Promise<ToolResult>;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
}

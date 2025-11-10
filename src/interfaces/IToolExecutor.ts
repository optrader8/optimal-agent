/**
 * Interface for Tool Executor
 */

import { ToolCall, ToolResult } from '../types.js';
import { ITool } from './ITool.js';

export interface IToolExecutor {
  /**
   * Execute a tool call
   */
  executeTool(toolCall: ToolCall): Promise<ToolResult>;

  /**
   * Register a new tool
   */
  registerTool(tool: ITool): void;

  /**
   * Get list of available tool names
   */
  getAvailableTools(): string[];

  /**
   * Get a specific tool by name
   */
  getTool(name: string): ITool | undefined;
}

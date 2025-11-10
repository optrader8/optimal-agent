/**
 * Tool Executor implementation
 */

import { IToolExecutor } from '../interfaces/IToolExecutor.js';
import { ITool } from '../interfaces/ITool.js';
import { ToolCall, ToolResult } from '../types.js';

export class ToolExecutor implements IToolExecutor {
  private tools: Map<string, ITool> = new Map();

  /**
   * Execute a tool call
   */
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.toolName);

    if (!tool) {
      return {
        success: false,
        output: '',
        errorMessage: `Unknown tool: ${toolCall.toolName}`,
        executionTime: 0,
      };
    }

    try {
      return await tool.execute(toolCall.parameters);
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `Tool execution failed: ${error.message}`,
        executionTime: 0,
      };
    }
  }

  /**
   * Register a new tool
   */
  registerTool(tool: ITool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get list of available tool names
   */
  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }
}

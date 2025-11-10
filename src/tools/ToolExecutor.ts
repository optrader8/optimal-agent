/**
 * Tool Executor implementation with error handling
 */

import { IToolExecutor } from '../interfaces/IToolExecutor.js';
import { ITool } from '../interfaces/ITool.js';
import { ToolCall, ToolResult } from '../types.js';
import { ErrorHandler } from '../errors/ErrorHandler.js';
import { ToolExecutionError } from '../errors/ErrorTypes.js';

export class ToolExecutor implements IToolExecutor {
  private tools: Map<string, ITool> = new Map();
  private errorHandler: ErrorHandler;

  constructor(errorHandler?: ErrorHandler) {
    this.errorHandler = errorHandler || new ErrorHandler();
  }

  /**
   * Execute a tool call with error handling and retry
   */
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.toolName);

    if (!tool) {
      const error = new ToolExecutionError(
        `Unknown tool: ${toolCall.toolName}`,
        undefined,
        { toolName: toolCall.toolName }
      );
      await this.errorHandler.logError(error);

      return {
        success: false,
        output: '',
        errorMessage: `Unknown tool: ${toolCall.toolName}`,
        executionTime: 0,
      };
    }

    try {
      // Use error handler's retry mechanism for tool execution
      const result = await this.errorHandler.handleWithRetry(
        () => tool.execute(toolCall.parameters),
        { maxRetries: 2, initialDelayMs: 500, exponentialBackoff: true },
        { toolName: toolCall.toolName, parameters: toolCall.parameters }
      );

      return result;
    } catch (error: any) {
      // Log the error
      const toolError = new ToolExecutionError(
        `Tool '${toolCall.toolName}' failed: ${error.message}`,
        error,
        { toolName: toolCall.toolName, parameters: toolCall.parameters }
      );
      await this.errorHandler.logError(toolError);

      // Return formatted error
      return {
        success: false,
        output: '',
        errorMessage: this.errorHandler.formatUserError(toolError),
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

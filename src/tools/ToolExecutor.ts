/**
 * Tool Executor implementation with error handling and execution monitoring
 */

import { IToolExecutor } from '../interfaces/IToolExecutor.js';
import { ITool } from '../interfaces/ITool.js';
import { ToolCall, ToolResult } from '../types.js';
import { ErrorHandler } from '../errors/ErrorHandler.js';
import { ToolExecutionError } from '../errors/ErrorTypes.js';
import { ExecutionMonitor, ExecutionOptions } from '../execution/ExecutionMonitor.js';

export class ToolExecutor implements IToolExecutor {
  private tools: Map<string, ITool> = new Map();
  private errorHandler: ErrorHandler;
  private executionMonitor: ExecutionMonitor;
  private defaultTimeout: number = 120000; // 2 minutes default

  constructor(errorHandler?: ErrorHandler, executionMonitor?: ExecutionMonitor) {
    this.errorHandler = errorHandler || new ErrorHandler();
    this.executionMonitor = executionMonitor || new ExecutionMonitor();
  }

  /**
   * Execute a tool call with error handling, retry, and monitoring
   */
  async executeTool(toolCall: ToolCall, options?: ExecutionOptions): Promise<ToolResult> {
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
      // Merge default timeout with provided options
      const executionOptions: ExecutionOptions = {
        timeout: this.defaultTimeout,
        trackResources: true,
        ...options,
      };

      // Use execution monitor with error handler retry
      const result = await this.errorHandler.handleWithRetry(
        () => this.executionMonitor.executeWithMonitoring(tool, toolCall.parameters, executionOptions),
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

  /**
   * Get the execution monitor
   */
  getExecutionMonitor(): ExecutionMonitor {
    return this.executionMonitor;
  }

  /**
   * Set default timeout for tool execution
   */
  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * Get default timeout
   */
  getDefaultTimeout(): number {
    return this.defaultTimeout;
  }
}

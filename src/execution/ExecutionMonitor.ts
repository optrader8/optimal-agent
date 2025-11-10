/**
 * Execution Monitor
 * Monitors tool execution with timeouts, resource tracking, and performance analytics
 */

import os from 'os';
import { ITool } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';

export interface ExecutionMetrics {
  toolName: string;
  executionId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  parameters: Record<string, any>;
  result?: ToolResult;
  error?: string;
  resourceUsage?: ResourceUsage;
  cancelled?: boolean;
  timedOut?: boolean;
}

export interface ResourceUsage {
  memoryBefore: number;
  memoryAfter: number;
  memoryDelta: number;
  cpuUsagePercent: number;
}

export interface ExecutionOptions {
  timeout?: number; // milliseconds
  trackResources?: boolean;
  signal?: AbortSignal; // For external cancellation
}

export interface PerformanceStats {
  toolName: string;
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  medianDuration: number;
  minDuration: number;
  maxDuration: number;
  timeouts: number;
  cancellations: number;
  errors: number;
  averageMemoryDelta: number;
}

export class ExecutionMonitor {
  private executionHistory: ExecutionMetrics[] = [];
  private activeExecutions: Map<string, AbortController> = new Map();
  private maxHistorySize: number = 1000;

  /**
   * Execute a tool with monitoring
   */
  async executeWithMonitoring(
    tool: ITool,
    parameters: Record<string, any>,
    options: ExecutionOptions = {}
  ): Promise<ToolResult> {
    const executionId = this.generateExecutionId();
    const startTime = new Date();
    const abortController = new AbortController();

    // Track active execution
    this.activeExecutions.set(executionId, abortController);

    // Resource tracking
    const memoryBefore = options.trackResources !== false
      ? process.memoryUsage().heapUsed
      : 0;

    const metrics: ExecutionMetrics = {
      toolName: tool.name,
      executionId,
      startTime,
      success: false,
      parameters,
    };

    try {
      // Setup timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          abortController.abort();
          metrics.timedOut = true;
        }, options.timeout);
      }

      // Setup external cancellation
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          abortController.abort();
          metrics.cancelled = true;
        });
      }

      // Execute tool with cancellation support
      const result = await this.executeWithCancellation(
        tool,
        parameters,
        abortController.signal
      );

      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId);

      // Record success
      metrics.success = result.success;
      metrics.result = result;
      metrics.endTime = new Date();
      metrics.duration = metrics.endTime.getTime() - startTime.getTime();

      // Track resource usage
      if (options.trackResources !== false) {
        const memoryAfter = process.memoryUsage().heapUsed;
        metrics.resourceUsage = {
          memoryBefore,
          memoryAfter,
          memoryDelta: memoryAfter - memoryBefore,
          cpuUsagePercent: this.getCpuUsage(),
        };
      }

      return result;
    } catch (error: any) {
      // Handle cancellation/timeout
      if (error.name === 'AbortError' || abortController.signal.aborted) {
        const message = metrics.timedOut
          ? `Tool execution timed out after ${options.timeout}ms`
          : 'Tool execution was cancelled';

        metrics.error = message;
        metrics.endTime = new Date();
        metrics.duration = metrics.endTime.getTime() - startTime.getTime();

        return {
          success: false,
          output: '',
          errorMessage: message,
          executionTime: metrics.duration,
        };
      }

      // Handle other errors
      metrics.success = false;
      metrics.error = error.message;
      metrics.endTime = new Date();
      metrics.duration = metrics.endTime.getTime() - startTime.getTime();

      throw error;
    } finally {
      // Cleanup
      this.activeExecutions.delete(executionId);
      this.recordExecution(metrics);
    }
  }

  /**
   * Execute tool with cancellation support
   */
  private async executeWithCancellation(
    tool: ITool,
    parameters: Record<string, any>,
    signal: AbortSignal
  ): Promise<ToolResult> {
    // Check if already aborted
    if (signal.aborted) {
      throw new DOMException('Execution aborted', 'AbortError');
    }

    // Create promise that rejects on abort
    const abortPromise = new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => {
        reject(new DOMException('Execution aborted', 'AbortError'));
      });
    });

    // Race between tool execution and abort
    return await Promise.race([
      tool.execute(parameters),
      abortPromise,
    ]);
  }

  /**
   * Cancel an active execution
   */
  cancelExecution(executionId: string): boolean {
    const controller = this.activeExecutions.get(executionId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  /**
   * Cancel all active executions
   */
  cancelAllExecutions(): number {
    let count = 0;
    for (const controller of this.activeExecutions.values()) {
      controller.abort();
      count++;
    }
    return count;
  }

  /**
   * Get active execution IDs
   */
  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  /**
   * Record execution metrics
   */
  private recordExecution(metrics: ExecutionMetrics): void {
    this.executionHistory.push(metrics);

    // Maintain max history size
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): ExecutionMetrics[] {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  /**
   * Get execution history for a specific tool
   */
  getToolHistory(toolName: string, limit?: number): ExecutionMetrics[] {
    const filtered = this.executionHistory.filter(m => m.toolName === toolName);
    if (limit) {
      return filtered.slice(-limit);
    }
    return filtered;
  }

  /**
   * Get performance statistics for a tool
   */
  getToolPerformance(toolName: string): PerformanceStats | null {
    const executions = this.getToolHistory(toolName);

    if (executions.length === 0) {
      return null;
    }

    const durations = executions
      .filter(e => e.duration !== undefined)
      .map(e => e.duration!) as number[];

    const successCount = executions.filter(e => e.success).length;
    const timeoutCount = executions.filter(e => e.timedOut).length;
    const cancelCount = executions.filter(e => e.cancelled).length;
    const errorCount = executions.filter(e => !e.success && !e.timedOut && !e.cancelled).length;

    const memoryDeltas = executions
      .filter(e => e.resourceUsage?.memoryDelta !== undefined)
      .map(e => e.resourceUsage!.memoryDelta);

    return {
      toolName,
      totalExecutions: executions.length,
      successRate: (successCount / executions.length) * 100,
      averageDuration: this.average(durations),
      medianDuration: this.median(durations),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      timeouts: timeoutCount,
      cancellations: cancelCount,
      errors: errorCount,
      averageMemoryDelta: this.average(memoryDeltas),
    };
  }

  /**
   * Get performance statistics for all tools
   */
  getAllPerformanceStats(): PerformanceStats[] {
    const toolNames = new Set(this.executionHistory.map(e => e.toolName));
    const stats: PerformanceStats[] = [];

    for (const toolName of toolNames) {
      const stat = this.getToolPerformance(toolName);
      if (stat) {
        stats.push(stat);
      }
    }

    return stats.sort((a, b) => b.totalExecutions - a.totalExecutions);
  }

  /**
   * Get slowest executions
   */
  getSlowestExecutions(limit: number = 10): ExecutionMetrics[] {
    return [...this.executionHistory]
      .filter(e => e.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, limit);
  }

  /**
   * Get recent failures
   */
  getRecentFailures(limit: number = 10): ExecutionMetrics[] {
    return [...this.executionHistory]
      .filter(e => !e.success)
      .slice(-limit)
      .reverse();
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Export execution history as JSON
   */
  exportHistory(): string {
    return JSON.stringify(this.executionHistory, null, 2);
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current CPU usage (simple estimation)
   */
  private getCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    }

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return usage;
  }

  /**
   * Calculate average
   */
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Calculate median
   */
  private median(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return sorted[mid];
  }

  /**
   * Format performance stats for display
   */
  formatPerformanceStats(stats: PerformanceStats): string {
    let output = `📊 Performance Stats: ${stats.toolName}\n`;
    output += `  Total Executions: ${stats.totalExecutions}\n`;
    output += `  Success Rate: ${stats.successRate.toFixed(1)}%\n`;
    output += `  Average Duration: ${stats.averageDuration.toFixed(2)}ms\n`;
    output += `  Median Duration: ${stats.medianDuration.toFixed(2)}ms\n`;
    output += `  Min/Max Duration: ${stats.minDuration.toFixed(2)}ms / ${stats.maxDuration.toFixed(2)}ms\n`;

    if (stats.timeouts > 0) {
      output += `  ⏱️  Timeouts: ${stats.timeouts}\n`;
    }

    if (stats.cancellations > 0) {
      output += `  🚫 Cancellations: ${stats.cancellations}\n`;
    }

    if (stats.errors > 0) {
      output += `  ❌ Errors: ${stats.errors}\n`;
    }

    if (stats.averageMemoryDelta !== 0) {
      const memMB = stats.averageMemoryDelta / 1024 / 1024;
      output += `  💾 Avg Memory Delta: ${memMB.toFixed(2)}MB\n`;
    }

    return output;
  }
}

// Global execution monitor instance
export const globalExecutionMonitor = new ExecutionMonitor();

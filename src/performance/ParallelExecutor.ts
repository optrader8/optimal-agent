/**
 * Parallel Executor
 * Executes multiple operations in parallel with concurrency control
 */

export interface ParallelTask<T> {
  id: string;
  execute: () => Promise<T>;
  priority?: number; // Higher priority executes first
}

export interface ParallelResult<T> {
  id: string;
  success: boolean;
  result?: T;
  error?: Error;
  duration: number;
}

export interface ParallelOptions {
  maxConcurrency?: number; // Maximum concurrent operations
  timeout?: number; // Timeout per task in milliseconds
  stopOnError?: boolean; // Stop all tasks if one fails
}

export class ParallelExecutor {
  private maxConcurrency: number;
  private timeout: number;
  private stopOnError: boolean;
  private running: number = 0;
  private queue: ParallelTask<any>[] = [];
  private results: Map<string, ParallelResult<any>> = new Map();
  private shouldStop: boolean = false;

  constructor(options: ParallelOptions = {}) {
    this.maxConcurrency = options.maxConcurrency || 5;
    this.timeout = options.timeout || 60000; // 1 minute default
    this.stopOnError = options.stopOnError || false;
  }

  /**
   * Execute tasks in parallel
   */
  async execute<T>(tasks: ParallelTask<T>[]): Promise<ParallelResult<T>[]> {
    this.reset();

    // Sort by priority (higher first)
    this.queue = [...tasks].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Start initial batch
    const promises: Promise<void>[] = [];
    while (this.running < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      promises.push(this.executeTask(task));
    }

    // Wait for all tasks to complete
    await Promise.all(promises);

    // Return results in original order
    return tasks.map(task => this.results.get(task.id)!);
  }

  /**
   * Execute a single task
   */
  private async executeTask<T>(task: ParallelTask<T>): Promise<void> {
    if (this.shouldStop) {
      this.results.set(task.id, {
        id: task.id,
        success: false,
        error: new Error('Execution stopped'),
        duration: 0,
      });
      return;
    }

    this.running++;
    const startTime = Date.now();

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(task.execute, this.timeout);

      this.results.set(task.id, {
        id: task.id,
        success: true,
        result,
        duration: Date.now() - startTime,
      });
    } catch (error: any) {
      this.results.set(task.id, {
        id: task.id,
        success: false,
        error,
        duration: Date.now() - startTime,
      });

      if (this.stopOnError) {
        this.shouldStop = true;
      }
    } finally {
      this.running--;

      // Execute next task from queue if available
      if (!this.shouldStop && this.queue.length > 0) {
        const nextTask = this.queue.shift()!;
        await this.executeTask(nextTask);
      }
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeout}ms`));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Reset executor state
   */
  private reset(): void {
    this.running = 0;
    this.queue = [];
    this.results.clear();
    this.shouldStop = false;
  }

  /**
   * Get execution statistics
   */
  getStats(results: ParallelResult<any>[]): {
    total: number;
    succeeded: number;
    failed: number;
    averageDuration: number;
    totalDuration: number;
  } {
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const durations = results.map(r => r.duration);
    const totalDuration = durations.reduce((a, b) => a + b, 0);
    const averageDuration = totalDuration / results.length;

    return {
      total: results.length,
      succeeded,
      failed,
      averageDuration,
      totalDuration,
    };
  }
}

/**
 * Batch processor for processing items in parallel batches
 */
export class BatchProcessor<T, R> {
  private executor: ParallelExecutor;

  constructor(options: ParallelOptions = {}) {
    this.executor = new ParallelExecutor(options);
  }

  /**
   * Process items in parallel batches
   */
  async process(
    items: T[],
    processor: (item: T, index: number) => Promise<R>
  ): Promise<ParallelResult<R>[]> {
    const tasks: ParallelTask<R>[] = items.map((item, index) => ({
      id: `task-${index}`,
      execute: () => processor(item, index),
      priority: items.length - index, // Earlier items have higher priority
    }));

    return await this.executor.execute(tasks);
  }

  /**
   * Process with progress callback
   */
  async processWithProgress(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    onProgress: (completed: number, total: number) => void
  ): Promise<R[]> {
    const tasks: ParallelTask<R>[] = items.map((item, index) => ({
      id: `task-${index}`,
      execute: async () => {
        const result = await processor(item, index);
        onProgress(index + 1, items.length);
        return result;
      },
    }));

    const results = await this.executor.execute(tasks);

    // Extract successful results
    return results
      .filter(r => r.success)
      .map(r => r.result as R);
  }
}

/**
 * Parallel file processor
 */
export class ParallelFileProcessor {
  private batchProcessor: BatchProcessor<string, any>;

  constructor(maxConcurrency: number = 5) {
    this.batchProcessor = new BatchProcessor({
      maxConcurrency,
      timeout: 30000, // 30 seconds per file
    });
  }

  /**
   * Process multiple files in parallel
   */
  async processFiles<T>(
    files: string[],
    processor: (filePath: string) => Promise<T>
  ): Promise<ParallelResult<T>[]> {
    return await this.batchProcessor.process(files, processor);
  }

  /**
   * Process files with progress callback
   */
  async processFilesWithProgress<T>(
    files: string[],
    processor: (filePath: string) => Promise<T>,
    onProgress: (completed: number, total: number) => void
  ): Promise<T[]> {
    return await this.batchProcessor.processWithProgress(
      files,
      processor,
      onProgress
    );
  }
}

// Global parallel executor instance
export const globalParallelExecutor = new ParallelExecutor({
  maxConcurrency: 5,
  timeout: 60000,
});

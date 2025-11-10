/**
 * Progress Indicator
 * Shows progress for long-running operations
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';

export interface ProgressOptions {
  text: string;
  color?: 'cyan' | 'green' | 'yellow' | 'red' | 'blue' | 'magenta';
}

export class ProgressIndicator {
  private spinner: Ora | null = null;
  private startTime: number = 0;

  /**
   * Start a new progress indicator
   */
  start(options: ProgressOptions): void {
    this.startTime = Date.now();
    this.spinner = ora({
      text: options.text,
      color: options.color || 'cyan',
    }).start();
  }

  /**
   * Update progress text
   */
  update(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  /**
   * Update with elapsed time
   */
  updateWithTime(text: string): void {
    const elapsed = Date.now() - this.startTime;
    const seconds = (elapsed / 1000).toFixed(1);
    this.update(`${text} ${chalk.gray(`(${seconds}s)`)}`);
  }

  /**
   * Mark as successful and stop
   */
  succeed(text?: string): void {
    if (this.spinner) {
      if (text) {
        this.spinner.succeed(text);
      } else {
        this.spinner.succeed();
      }
      this.spinner = null;
    }
  }

  /**
   * Mark as failed and stop
   */
  fail(text?: string): void {
    if (this.spinner) {
      if (text) {
        this.spinner.fail(text);
      } else {
        this.spinner.fail();
      }
      this.spinner = null;
    }
  }

  /**
   * Mark as warning and stop
   */
  warn(text?: string): void {
    if (this.spinner) {
      if (text) {
        this.spinner.warn(text);
      } else {
        this.spinner.warn();
      }
      this.spinner = null;
    }
  }

  /**
   * Mark as info and stop
   */
  info(text?: string): void {
    if (this.spinner) {
      if (text) {
        this.spinner.info(text);
      } else {
        this.spinner.info();
      }
      this.spinner = null;
    }
  }

  /**
   * Stop without marking
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Check if currently running
   */
  isRunning(): boolean {
    return this.spinner !== null;
  }

  /**
   * Get elapsed time in milliseconds
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }
}

// Global progress indicator
export const globalProgress = new ProgressIndicator();

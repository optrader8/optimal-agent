/**
 * Run Tests Tool
 * Automatically detects test framework and runs tests
 */

import { ITool, ToolResult, ToolParameter } from '../interfaces/ITool.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export class RunTestsTool implements ITool {
  name = 'run_tests';
  description = 'Run tests with automatic framework detection (Jest, Mocha, Vitest, pytest, etc.)';

  parameters: Record<string, ToolParameter> = {
    path: {
      type: 'string',
      description: 'Path to test file or directory (optional)',
      required: false,
    },
    framework: {
      type: 'string',
      description: 'Test framework (auto-detected if not specified)',
      required: false,
    },
    pattern: {
      type: 'string',
      description: 'Test pattern or filter',
      required: false,
    },
    coverage: {
      type: 'boolean',
      description: 'Run with coverage report',
      required: false,
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const testPath = params.path || '.';
      const coverage = params.coverage || false;

      // Auto-detect test framework
      const framework = params.framework || await this.detectFramework();

      if (!framework) {
        return {
          success: false,
          output: '',
          errorMessage: 'No test framework detected. Please install Jest, Mocha, Vitest, or pytest.',
          executionTime: 0,
        };
      }

      // Build test command
      const command = await this.buildTestCommand(framework, testPath, params.pattern, coverage);

      console.log(`Running tests with ${framework}: ${command}`);

      // Execute tests
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 300000, // 5 minute timeout
      });
      const executionTime = Date.now() - startTime;

      // Parse test results
      const results = this.parseTestResults(framework, stdout, stderr);
      const output = `Framework: ${framework}\nCommand: ${command}\n\n${results}`;

      return {
        success: true,
        output,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - Date.now(); // Approximate
      // Tests might fail but still produce useful output
      const output = error.stdout || error.stderr || error.message;
      const results = this.parseTestResults(params.framework || 'unknown', output, error.stderr || '');

      return {
        success: false,
        output: results,
        errorMessage: `Tests failed with exit code ${error.code}`,
        executionTime,
      };
    }
  }

  /**
   * Auto-detect test framework from package.json
   */
  private async detectFramework(): Promise<string | null> {
    try {
      const packageJson = await fs.readFile('package.json', 'utf-8');
      const pkg = JSON.parse(packageJson);

      const dependencies = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      // Check for common frameworks in order of preference
      if (dependencies['vitest']) return 'vitest';
      if (dependencies['jest']) return 'jest';
      if (dependencies['mocha']) return 'mocha';
      if (dependencies['ava']) return 'ava';
      if (dependencies['tape']) return 'tape';

      // Check scripts
      if (pkg.scripts?.test) {
        if (pkg.scripts.test.includes('vitest')) return 'vitest';
        if (pkg.scripts.test.includes('jest')) return 'jest';
        if (pkg.scripts.test.includes('mocha')) return 'mocha';
      }

      // Check for Python pytest
      try {
        await execAsync('pytest --version');
        return 'pytest';
      } catch {
        // pytest not available
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Build test command based on framework
   */
  private async buildTestCommand(
    framework: string,
    testPath: string,
    pattern?: string,
    coverage?: boolean
  ): Promise<string> {
    const commands: Record<string, string> = {
      jest: `npx jest ${testPath}${pattern ? ` -t "${pattern}"` : ''}${coverage ? ' --coverage' : ''}`,
      vitest: `npx vitest run ${testPath}${pattern ? ` -t "${pattern}"` : ''}${coverage ? ' --coverage' : ''}`,
      mocha: `npx mocha ${testPath}${pattern ? ` --grep "${pattern}"` : ''}`,
      ava: `npx ava ${testPath}${pattern ? ` --match="${pattern}"` : ''}`,
      pytest: `pytest ${testPath}${pattern ? ` -k "${pattern}"` : ''}${coverage ? ' --cov' : ''}`,
    };

    return commands[framework] || `npm test`;
  }

  /**
   * Parse test results from output
   */
  private parseTestResults(framework: string, stdout: string, stderr: string): string {
    const output = stdout + '\n' + stderr;
    const lines = output.split('\n');

    // Extract key information
    const summary: string[] = [];

    // Look for test summary patterns
    const patterns = {
      passed: /(\d+)\s+(passed|passing)/i,
      failed: /(\d+)\s+(failed|failing)/i,
      total: /Tests:\s+(\d+)\s+total/i,
      duration: /Time:\s+([\d.]+\s*s)/i,
      coverage: /Coverage:\s+([\d.]+)%/i,
    };

    for (const line of lines) {
      for (const [key, pattern] of Object.entries(patterns)) {
        const match = line.match(pattern);
        if (match) {
          summary.push(line.trim());
        }
      }
    }

    // If no structured summary found, try to extract last 20 lines
    if (summary.length === 0) {
      const relevantLines = lines.filter(line =>
        line.includes('✓') ||
        line.includes('✗') ||
        line.includes('PASS') ||
        line.includes('FAIL') ||
        line.includes('Error') ||
        line.includes('expected')
      );

      return relevantLines.slice(-30).join('\n') || output.slice(-2000);
    }

    // Return full output with summary at the top
    return `Test Summary:\n${summary.join('\n')}\n\n${output.slice(-3000)}`;
  }
}

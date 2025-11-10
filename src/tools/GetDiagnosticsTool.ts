/**
 * Get Diagnostics Tool
 * Runs linting, type checking, and other code quality checks
 */

import { ITool, ToolResult, ToolParameter } from '../interfaces/ITool.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export class GetDiagnosticsTool implements ITool {
  name = 'get_diagnostics';
  description = 'Run code diagnostics including linting, type checking, and code quality analysis';

  parameters: Record<string, ToolParameter> = {
    path: {
      type: 'string',
      description: 'Path to file or directory to check',
      required: false,
    },
    type: {
      type: 'string',
      description: 'Diagnostic type: lint, typecheck, all (default: all)',
      required: false,
    },
    fix: {
      type: 'boolean',
      description: 'Attempt to auto-fix issues',
      required: false,
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const targetPath = params.path || '.';
      const diagnosticType = params.type || 'all';
      const autoFix = params.fix || false;

      const results: string[] = [];
      results.push(`Path: ${targetPath}`);
      results.push(`Type: ${diagnosticType}`);
      results.push(`Auto-fix: ${autoFix}`);
      results.push('');

      // Run requested diagnostics
      if (diagnosticType === 'all' || diagnosticType === 'lint') {
        const lintResult = await this.runLinter(targetPath, autoFix);
        if (lintResult) {
          results.push('=== Linting Results ===\n' + lintResult);
        }
      }

      if (diagnosticType === 'all' || diagnosticType === 'typecheck') {
        const typeResult = await this.runTypeCheck(targetPath);
        if (typeResult) {
          results.push('=== Type Checking Results ===\n' + typeResult);
        }
      }

      const executionTime = Date.now() - startTime;

      if (results.length === 4) { // Only header lines, no results
        return {
          success: true,
          output: '✓ No diagnostic tools available or no issues found.',
          executionTime,
        };
      }

      const output = results.join('\n');

      return {
        success: true,
        output,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        output: '',
        errorMessage: `Diagnostics failed: ${error.message}`,
        executionTime,
      };
    }
  }

  /**
   * Run ESLint or other linter
   */
  private async runLinter(targetPath: string, fix: boolean): Promise<string | null> {
    try {
      // Check if ESLint is available
      const hasESLint = await this.hasPackage('eslint');

      if (hasESLint) {
        const command = `npx eslint ${targetPath}${fix ? ' --fix' : ''} --format compact`;

        try {
          const { stdout, stderr } = await execAsync(command, {
            maxBuffer: 1024 * 1024 * 5,
            timeout: 60000,
          });

          const output = stdout || stderr;

          if (!output || output.trim().length === 0) {
            return '✓ No linting issues found';
          }

          return this.formatLintOutput(output);
        } catch (error: any) {
          // ESLint returns exit code 1 when issues found
          if (error.stdout) {
            return this.formatLintOutput(error.stdout);
          }
          return `Linting completed with issues:\n${error.message}`;
        }
      }

      // Check for other linters
      const hasBiome = await this.hasCommand('biome');
      if (hasBiome) {
        try {
          const { stdout } = await execAsync(`biome lint ${targetPath}`);
          return stdout || '✓ No linting issues found';
        } catch (error: any) {
          return error.stdout || error.message;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Run TypeScript type checking
   */
  private async runTypeCheck(targetPath: string): Promise<string | null> {
    try {
      // Check if TypeScript is available
      const hasTypeScript = await this.hasPackage('typescript');

      if (!hasTypeScript) {
        return null;
      }

      try {
        const { stdout, stderr } = await execAsync('npx tsc --noEmit', {
          maxBuffer: 1024 * 1024 * 5,
          timeout: 120000,
        });

        return '✓ No type errors found';
      } catch (error: any) {
        // tsc returns exit code 2 when type errors found
        if (error.stdout || error.stderr) {
          return this.formatTypeCheckOutput(error.stdout || error.stderr);
        }
        return `Type checking failed:\n${error.message}`;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Format lint output for readability
   */
  private formatLintOutput(output: string): string {
    const lines = output.split('\n').filter(line => line.trim().length > 0);

    // Count issues
    const errors = lines.filter(line => line.includes('error')).length;
    const warnings = lines.filter(line => line.includes('warning')).length;

    let summary = '';
    if (errors > 0) summary += `${errors} error(s)`;
    if (warnings > 0) summary += `${errors > 0 ? ', ' : ''}${warnings} warning(s)`;

    // Show first 50 lines of issues
    const issueSummary = lines.slice(0, 50).join('\n');

    return `${summary}\n\n${issueSummary}${lines.length > 50 ? `\n\n... and ${lines.length - 50} more issues` : ''}`;
  }

  /**
   * Format type check output for readability
   */
  private formatTypeCheckOutput(output: string): string {
    const lines = output.split('\n').filter(line => line.trim().length > 0);

    // Extract error lines
    const errorLines = lines.filter(line =>
      line.includes('error TS') || line.includes('.ts(')
    );

    // Count errors
    const errorCount = errorLines.filter(line => line.includes('error TS')).length;

    // Show first 30 errors
    const summary = errorLines.slice(0, 30).join('\n');

    return `${errorCount} type error(s) found\n\n${summary}${errorLines.length > 30 ? `\n\n... and ${errorLines.length - 30} more errors` : ''}`;
  }

  /**
   * Check if a package is installed
   */
  private async hasPackage(packageName: string): Promise<boolean> {
    try {
      const packageJson = await fs.readFile('package.json', 'utf-8');
      const pkg = JSON.parse(packageJson);

      const dependencies = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      return packageName in dependencies;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a command is available
   */
  private async hasCommand(command: string): Promise<boolean> {
    try {
      await execAsync(`which ${command}`);
      return true;
    } catch (error) {
      return false;
    }
  }
}

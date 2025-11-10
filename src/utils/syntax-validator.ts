/**
 * Syntax Validation Utilities
 * Validates syntax for various file types before saving
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  line?: number;
  column?: number;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  line?: number;
  column?: number;
  message: string;
  severity: 'warning';
}

export class SyntaxValidator {
  /**
   * Validate file based on extension
   */
  async validateFile(filePath: string, content?: string): Promise<ValidationResult> {
    const ext = path.extname(filePath).toLowerCase();

    // Read content if not provided
    if (!content) {
      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch (error: any) {
        return {
          valid: false,
          errors: [{ message: `Failed to read file: ${error.message}`, severity: 'error' }],
          warnings: [],
        };
      }
    }

    // Route to appropriate validator
    switch (ext) {
      case '.js':
      case '.mjs':
      case '.cjs':
        return await this.validateJavaScript(content);

      case '.ts':
      case '.tsx':
        return await this.validateTypeScript(filePath, content);

      case '.json':
        return this.validateJSON(content);

      case '.md':
      case '.markdown':
        return this.validateMarkdown(content);

      case '.py':
        return await this.validatePython(content);

      default:
        // For unknown file types, just check if it's valid UTF-8
        return this.validatePlainText(content);
    }
  }

  /**
   * Validate JavaScript syntax
   */
  private async validateJavaScript(content: string): Promise<ValidationResult> {
    try {
      // Use Node.js to parse the JS
      const { spawn } = await import('child_process');
      const proc = spawn('node', ['--check'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.stdin.write(content);
      proc.stdin.end();

      return new Promise((resolve) => {
        proc.on('close', (code) => {
          if (code === 0) {
            resolve({
              valid: true,
              errors: [],
              warnings: [],
            });
          } else {
            const errors = this.parseNodeErrors(stderr);
            resolve({
              valid: false,
              errors,
              warnings: [],
            });
          }
        });
      });
    } catch (error: any) {
      return {
        valid: false,
        errors: [{ message: `Validation failed: ${error.message}`, severity: 'error' }],
        warnings: [],
      };
    }
  }

  /**
   * Validate TypeScript syntax
   */
  private async validateTypeScript(filePath: string, content: string): Promise<ValidationResult> {
    try {
      // Write to temp file for tsc to check
      const tempFile = `/tmp/syntax-check-${Date.now()}.ts`;
      await fs.writeFile(tempFile, content, 'utf-8');

      try {
        const { stderr } = await execAsync(`npx tsc --noEmit --skipLibCheck ${tempFile}`, {
          timeout: 10000,
        });

        // tsc succeeded
        await fs.unlink(tempFile);
        return {
          valid: true,
          errors: [],
          warnings: [],
        };
      } catch (error: any) {
        // tsc found errors
        await fs.unlink(tempFile).catch(() => {});
        const errors = this.parseTypeScriptErrors(error.stdout || error.stderr || '');

        return {
          valid: errors.length === 0,
          errors,
          warnings: [],
        };
      }
    } catch (error: any) {
      return {
        valid: false,
        errors: [{ message: `TypeScript validation failed: ${error.message}`, severity: 'error' }],
        warnings: [],
      };
    }
  }

  /**
   * Validate JSON syntax
   */
  private validateJSON(content: string): ValidationResult {
    try {
      JSON.parse(content);
      return {
        valid: true,
        errors: [],
        warnings: [],
      };
    } catch (error: any) {
      const match = error.message.match(/position (\d+)/);
      const position = match ? parseInt(match[1]) : undefined;

      // Calculate line and column from position
      let line: number | undefined;
      let column: number | undefined;

      if (position !== undefined) {
        const lines = content.substring(0, position).split('\n');
        line = lines.length;
        column = lines[lines.length - 1].length + 1;
      }

      return {
        valid: false,
        errors: [{
          line,
          column,
          message: `JSON parsing error: ${error.message}`,
          severity: 'error',
        }],
        warnings: [],
      };
    }
  }

  /**
   * Validate Markdown syntax (basic)
   */
  private validateMarkdown(content: string): ValidationResult {
    const warnings: ValidationWarning[] = [];

    // Check for common issues
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      // Check for unclosed code blocks
      if (line.trim().startsWith('```')) {
        const codeBlockCount = content.split('```').length - 1;
        if (codeBlockCount % 2 !== 0) {
          warnings.push({
            line: idx + 1,
            message: 'Possibly unclosed code block',
            severity: 'warning',
          });
        }
      }
    });

    return {
      valid: true,
      errors: [],
      warnings,
    };
  }

  /**
   * Validate Python syntax
   */
  private async validatePython(content: string): Promise<ValidationResult> {
    try {
      // Write to temp file for python to check
      const tempFile = `/tmp/syntax-check-${Date.now()}.py`;
      await fs.writeFile(tempFile, content, 'utf-8');

      try {
        await execAsync(`python3 -m py_compile ${tempFile}`, {
          timeout: 5000,
        });

        // Cleanup
        await fs.unlink(tempFile);
        await fs.unlink(tempFile + 'c').catch(() => {}); // Remove .pyc file

        return {
          valid: true,
          errors: [],
          warnings: [],
        };
      } catch (error: any) {
        // Cleanup
        await fs.unlink(tempFile).catch(() => {});
        await fs.unlink(tempFile + 'c').catch(() => {});

        const errors = this.parsePythonErrors(error.stderr || error.message);
        return {
          valid: false,
          errors,
          warnings: [],
        };
      }
    } catch (error: any) {
      return {
        valid: false,
        errors: [{ message: `Python validation failed: ${error.message}`, severity: 'error' }],
        warnings: [],
      };
    }
  }

  /**
   * Validate plain text (just UTF-8 check)
   */
  private validatePlainText(content: string): ValidationResult {
    try {
      // Check if content is valid UTF-8
      Buffer.from(content, 'utf-8').toString('utf-8');

      return {
        valid: true,
        errors: [],
        warnings: [],
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [{ message: 'Invalid UTF-8 encoding', severity: 'error' }],
        warnings: [],
      };
    }
  }

  /**
   * Parse Node.js syntax errors
   */
  private parseNodeErrors(stderr: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const lines = stderr.split('\n');

    for (const line of lines) {
      const match = line.match(/SyntaxError: (.+)/);
      if (match) {
        errors.push({
          message: match[1],
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Parse TypeScript errors
   */
  private parseTypeScriptErrors(output: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match pattern: file.ts(line,col): error TS1234: message
      const match = line.match(/\((\d+),(\d+)\): error TS\d+: (.+)/);
      if (match) {
        errors.push({
          line: parseInt(match[1]),
          column: parseInt(match[2]),
          message: match[3],
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Parse Python errors
   */
  private parsePythonErrors(stderr: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const lines = stderr.split('\n');

    for (const line of lines) {
      if (line.includes('SyntaxError:') || line.includes('IndentationError:')) {
        errors.push({
          message: line.trim(),
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Format validation result for display
   */
  formatValidationResult(result: ValidationResult): string {
    if (result.valid && result.warnings.length === 0) {
      return '✓ Syntax validation passed';
    }

    let output = '';

    if (result.errors.length > 0) {
      output += '❌ Syntax Errors:\n';
      result.errors.forEach((err, idx) => {
        const location = err.line ? ` (line ${err.line}${err.column ? `, col ${err.column}` : ''})` : '';
        output += `  ${idx + 1}. ${err.message}${location}\n`;
      });
    }

    if (result.warnings.length > 0) {
      output += '\n⚠️  Warnings:\n';
      result.warnings.forEach((warn, idx) => {
        const location = warn.line ? ` (line ${warn.line}${warn.column ? `, col ${warn.column}` : ''})` : '';
        output += `  ${idx + 1}. ${warn.message}${location}\n`;
      });
    }

    return output;
  }
}

// Global syntax validator instance
export const globalSyntaxValidator = new SyntaxValidator();

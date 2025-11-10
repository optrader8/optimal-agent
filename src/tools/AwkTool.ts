/**
 * AWK Tool - Pattern scanning and processing
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validateFilePath } from '../utils/validation.js';

const execAsync = promisify(exec);

export class AwkTool implements ITool {
  name = 'awk';
  description = 'Process text using AWK pattern scanning';
  parameters: Record<string, ToolParameter> = {
    script: {
      type: 'string',
      description: 'AWK script to execute',
      required: true,
    },
    file: {
      type: 'string',
      description: 'File to process (optional, can use stdin)',
      required: false,
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const script = params.script;
      const file = params.file;

      // Validate file if provided
      if (file) {
        const validation = validateFilePath(file);
        if (!validation.valid) {
          return {
            success: false,
            output: '',
            errorMessage: validation.errors.join(', '),
            executionTime: Date.now() - startTime,
          };
        }
      }

      // Build awk command
      const command = file
        ? `awk '${script.replace(/'/g, "'\\''")}' "${file}"`
        : `awk '${script.replace(/'/g, "'\\''")}' `;

      const { stdout, stderr } = await execAsync(command, {
        timeout: 10000,
      });

      return {
        success: true,
        output: stdout + (stderr ? `\nStderr: ${stderr}` : ''),
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || '',
        errorMessage: `AWK failed: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

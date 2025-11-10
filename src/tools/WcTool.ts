/**
 * WC Tool - Word, line, character count
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validateFilePath } from '../utils/validation.js';

const execAsync = promisify(exec);

export class WcTool implements ITool {
  name = 'wc';
  description = 'Count words, lines, characters in files';
  parameters: Record<string, ToolParameter> = {
    path: {
      type: 'string',
      description: 'File or directory path',
      required: true,
    },
    lines: {
      type: 'boolean',
      description: 'Count lines only',
      required: false,
      default: false,
    },
    words: {
      type: 'boolean',
      description: 'Count words only',
      required: false,
      default: false,
    },
    chars: {
      type: 'boolean',
      description: 'Count characters only',
      required: false,
      default: false,
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Validate path
      const validation = validateFilePath(params.path);
      if (!validation.valid) {
        return {
          success: false,
          output: '',
          errorMessage: validation.errors.join(', '),
          executionTime: Date.now() - startTime,
        };
      }

      // Build wc command
      let command = 'wc';

      if (params.lines) {
        command += ' -l';
      } else if (params.words) {
        command += ' -w';
      } else if (params.chars) {
        command += ' -c';
      }

      command += ` "${params.path}"`;

      const { stdout } = await execAsync(command);

      return {
        success: true,
        output: stdout,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `wc failed: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

/**
 * Ripgrep Search Tool - Advanced code search
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validateFilePath } from '../utils/validation.js';

const execAsync = promisify(exec);

export class RipgrepTool implements ITool {
  name = 'ripgrep';
  description = 'Advanced code search using ripgrep (faster than grep)';
  parameters: Record<string, ToolParameter> = {
    pattern: {
      type: 'string',
      description: 'Pattern to search for (supports regex)',
      required: true,
    },
    path: {
      type: 'string',
      description: 'Path to search in',
      required: false,
      default: '.',
    },
    fileType: {
      type: 'string',
      description: 'File type filter (e.g., ts, js, py)',
      required: false,
    },
    ignoreCase: {
      type: 'boolean',
      description: 'Case insensitive search',
      required: false,
      default: false,
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const pattern = params.pattern;
      const searchPath = params.path || '.';
      const fileType = params.fileType;
      const ignoreCase = params.ignoreCase || false;

      // Validate path
      const validation = validateFilePath(searchPath);
      if (!validation.valid) {
        return {
          success: false,
          output: '',
          errorMessage: validation.errors.join(', '),
          executionTime: Date.now() - startTime,
        };
      }

      // Build ripgrep command
      let command = 'rg';

      if (ignoreCase) {
        command += ' -i';
      }

      if (fileType) {
        command += ` -t ${fileType}`;
      }

      // Add line numbers and context
      command += ' -n';

      command += ` "${pattern.replace(/"/g, '\\"')}" "${searchPath}"`;

      // Fallback to grep if ripgrep not available
      try {
        const { stdout } = await execAsync(command);
        return {
          success: true,
          output: stdout || 'No matches found',
          executionTime: Date.now() - startTime,
        };
      } catch (error: any) {
        if (error.message.includes('rg: command not found')) {
          // Fallback to grep
          const grepCmd = `grep -rn${ignoreCase ? 'i' : ''} "${pattern.replace(/"/g, '\\"')}" "${searchPath}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist || true`;
          const { stdout } = await execAsync(grepCmd);
          return {
            success: true,
            output: stdout || 'No matches found (using grep fallback)',
            executionTime: Date.now() - startTime,
          };
        }
        throw error;
      }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `Ripgrep search failed: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

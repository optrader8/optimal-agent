/**
 * Grep Search Tool
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validateFilePath } from '../utils/validation.js';

const execAsync = promisify(exec);

export class GrepSearchTool implements ITool {
  name = 'grep_search';
  description = 'Search for code patterns using grep';
  parameters: Record<string, ToolParameter> = {
    pattern: {
      type: 'string',
      description: 'Pattern to search for',
      required: true,
    },
    path: {
      type: 'string',
      description: 'Path to search in',
      required: false,
      default: '.',
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const pattern = params.pattern;
      const searchPath = params.path || '.';

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

      // Execute grep command (recursive, line numbers, exclude common directories)
      const command = `grep -rn "${pattern.replace(/"/g, '\\"')}" "${searchPath}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build || true`;

      const { stdout } = await execAsync(command);

      return {
        success: true,
        output: stdout || 'No matches found',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `Grep search failed: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

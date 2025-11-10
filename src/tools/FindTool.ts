/**
 * Find Tool - Search for files and directories
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validateFilePath } from '../utils/validation.js';

const execAsync = promisify(exec);

export class FindTool implements ITool {
  name = 'find';
  description = 'Search for files and directories by name or pattern';
  parameters: Record<string, ToolParameter> = {
    path: {
      type: 'string',
      description: 'Starting directory for search',
      required: false,
      default: '.',
    },
    name: {
      type: 'string',
      description: 'File name pattern (supports wildcards)',
      required: false,
    },
    type: {
      type: 'string',
      description: 'Type: f (file), d (directory)',
      required: false,
    },
    maxDepth: {
      type: 'number',
      description: 'Maximum search depth',
      required: false,
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
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

      // Build find command
      let command = `find "${searchPath}"`;

      if (params.maxDepth) {
        command += ` -maxdepth ${params.maxDepth}`;
      }

      if (params.type) {
        command += ` -type ${params.type}`;
      }

      if (params.name) {
        command += ` -name "${params.name}"`;
      }

      // Exclude common directories
      command +=
        ' -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*"';

      const { stdout } = await execAsync(command, {
        timeout: 30000,
      });

      return {
        success: true,
        output: stdout || 'No files found',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `find failed: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

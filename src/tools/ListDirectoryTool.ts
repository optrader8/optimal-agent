/**
 * List Directory Tool
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import * as fs from 'fs/promises';
import { validateFilePath, sanitizeFilePath } from '../utils/validation.js';

export class ListDirectoryTool implements ITool {
  name = 'list_directory';
  description = 'List files and directories in a given path';
  parameters: Record<string, ToolParameter> = {
    path: {
      type: 'string',
      description: 'Path to the directory to list',
      required: true,
      default: '.',
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Validate path
      const validation = validateFilePath(params.path || '.');
      if (!validation.valid) {
        return {
          success: false,
          output: '',
          errorMessage: validation.errors.join(', '),
          executionTime: Date.now() - startTime,
        };
      }

      // Sanitize and resolve path
      const dirPath = sanitizeFilePath(params.path || '.');

      // Read directory
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      // Format output
      const output = entries
        .map((entry) => {
          const type = entry.isDirectory() ? '[DIR]' : '[FILE]';
          return `${type} ${entry.name}`;
        })
        .join('\n');

      return {
        success: true,
        output,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `Failed to list directory: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

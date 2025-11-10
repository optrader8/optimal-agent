/**
 * Read File Tool
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateFilePath, sanitizeFilePath } from '../utils/validation.js';

export class ReadFileTool implements ITool {
  name = 'read_file';
  description = 'Read the contents of a file';
  parameters: Record<string, ToolParameter> = {
    path: {
      type: 'string',
      description: 'Path to the file to read',
      required: true,
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

      // Sanitize and resolve path
      const filePath = sanitizeFilePath(params.path);

      // Read file
      const content = await fs.readFile(filePath, 'utf-8');

      return {
        success: true,
        output: content,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `Failed to read file: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

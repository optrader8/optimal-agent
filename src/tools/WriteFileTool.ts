/**
 * Write File Tool
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateFilePath, sanitizeFilePath } from '../utils/validation.js';

export class WriteFileTool implements ITool {
  name = 'write_file';
  description = 'Create or overwrite a file with content';
  parameters: Record<string, ToolParameter> = {
    path: {
      type: 'string',
      description: 'Path to the file to write',
      required: true,
    },
    content: {
      type: 'string',
      description: 'Content to write to the file',
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

      // Create directory if it doesn't exist
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, params.content, 'utf-8');

      return {
        success: true,
        output: `File written successfully: ${filePath}`,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `Failed to write file: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

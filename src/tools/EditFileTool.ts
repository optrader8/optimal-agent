/**
 * Edit File Tool - Make targeted edits to files
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import * as fs from 'fs/promises';
import { validateFilePath, sanitizeFilePath } from '../utils/validation.js';

export class EditFileTool implements ITool {
  name = 'edit_file';
  description = 'Edit specific lines or ranges in a file';
  parameters: Record<string, ToolParameter> = {
    path: {
      type: 'string',
      description: 'Path to file to edit',
      required: true,
    },
    lineStart: {
      type: 'number',
      description: 'Starting line number (1-indexed)',
      required: false,
    },
    lineEnd: {
      type: 'number',
      description: 'Ending line number (1-indexed)',
      required: false,
    },
    oldText: {
      type: 'string',
      description: 'Text to replace (exact match)',
      required: false,
    },
    newText: {
      type: 'string',
      description: 'New text to insert',
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

      const filePath = sanitizeFilePath(params.path);

      // Read file
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      let newContent: string;

      if (params.oldText) {
        // Replace by text match
        if (!content.includes(params.oldText)) {
          return {
            success: false,
            output: '',
            errorMessage: 'Old text not found in file',
            executionTime: Date.now() - startTime,
          };
        }

        newContent = content.replace(params.oldText, params.newText);
      } else if (params.lineStart !== undefined) {
        // Replace by line numbers
        const start = params.lineStart - 1; // Convert to 0-indexed
        const end = params.lineEnd ? params.lineEnd - 1 : start;

        if (start < 0 || start >= lines.length) {
          return {
            success: false,
            output: '',
            errorMessage: `Line ${params.lineStart} is out of range`,
            executionTime: Date.now() - startTime,
          };
        }

        // Replace lines
        lines.splice(start, end - start + 1, params.newText);
        newContent = lines.join('\n');
      } else {
        return {
          success: false,
          output: '',
          errorMessage:
            'Either oldText or lineStart must be provided',
          executionTime: Date.now() - startTime,
        };
      }

      // Write back to file
      await fs.writeFile(filePath, newContent, 'utf-8');

      return {
        success: true,
        output: `File edited successfully: ${filePath}`,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `Failed to edit file: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

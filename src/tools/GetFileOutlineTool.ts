/**
 * Get File Outline Tool - Extract structure from code files
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import * as fs from 'fs/promises';
import { validateFilePath, sanitizeFilePath } from '../utils/validation.js';

export class GetFileOutlineTool implements ITool {
  name = 'get_file_outline';
  description = 'Extract functions, classes, and key structures from a file';
  parameters: Record<string, ToolParameter> = {
    path: {
      type: 'string',
      description: 'Path to the file',
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
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const outline: string[] = [];

      // Simple pattern matching for common structures
      const patterns = [
        { regex: /^(export\s+)?(class|interface|type|enum)\s+(\w+)/,  prefix: '📦' },
        { regex: /^(export\s+)?(function|const|let|var)\s+(\w+)\s*=/,  prefix: '⚡' },
        { regex: /^(async\s+)?function\s+(\w+)\s*\(/,  prefix: '🔧' },
        { regex: /^\s*(public|private|protected)?\s*(async\s+)?(\w+)\s*\([^)]*\)\s*{/,  prefix: '🔹' },
      ];

      lines.forEach((line, index) => {
        for (const { regex, prefix } of patterns) {
          const match = line.match(regex);
          if (match) {
            const lineNum = index + 1;
            outline.push(`${prefix} Line ${lineNum}: ${line.trim()}`);
            break;
          }
        }
      });

      if (outline.length === 0) {
        return {
          success: true,
          output: 'No functions or classes found in file',
          executionTime: Date.now() - startTime,
        };
      }

      return {
        success: true,
        output: outline.join('\n'),
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `Failed to get file outline: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

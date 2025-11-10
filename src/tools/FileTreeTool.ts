/**
 * File Tree Tool
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateFilePath, sanitizeFilePath } from '../utils/validation.js';

export class FileTreeTool implements ITool {
  name = 'file_tree';
  description = 'Display directory structure as a tree';
  parameters: Record<string, ToolParameter> = {
    path: {
      type: 'string',
      description: 'Path to the root directory',
      required: true,
      default: '.',
    },
    depth: {
      type: 'number',
      description: 'Maximum depth to traverse',
      required: false,
      default: 3,
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
      const rootPath = sanitizeFilePath(params.path || '.');
      const maxDepth = params.depth || 3;

      // Build tree
      const tree = await this.buildTree(rootPath, '', 0, maxDepth);

      return {
        success: true,
        output: tree,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `Failed to build file tree: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async buildTree(
    dirPath: string,
    prefix: string,
    currentDepth: number,
    maxDepth: number
  ): Promise<string> {
    if (currentDepth >= maxDepth) {
      return '';
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let result = '';

      // Filter out common ignored directories
      const filtered = entries.filter(
        (entry) =>
          !['node_modules', '.git', 'dist', 'build', '.next'].includes(
            entry.name
          )
      );

      for (let i = 0; i < filtered.length; i++) {
        const entry = filtered[i];
        const isLast = i === filtered.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const newPrefix = prefix + (isLast ? '    ' : '│   ');

        result += `${prefix}${connector}${entry.name}\n`;

        if (entry.isDirectory()) {
          const subPath = path.join(dirPath, entry.name);
          result += await this.buildTree(
            subPath,
            newPrefix,
            currentDepth + 1,
            maxDepth
          );
        }
      }

      return result;
    } catch (error) {
      return `${prefix}[Error reading directory]\n`;
    }
  }
}

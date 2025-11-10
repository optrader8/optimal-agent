/**
 * File Statistics Tool
 * Get detailed file/directory metadata
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import * as fs from 'fs/promises';
import { validateFilePath, sanitizeFilePath } from '../utils/validation.js';

export class FileStatTool implements ITool {
  name = 'file_stat';
  description = 'Get detailed file or directory statistics and metadata';
  parameters: Record<string, ToolParameter> = {
    path: {
      type: 'string',
      description: 'Path to file or directory',
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

      // Get file stats
      const stats = await fs.stat(filePath);

      // Format output
      const output = {
        path: filePath,
        type: stats.isFile()
          ? 'file'
          : stats.isDirectory()
            ? 'directory'
            : stats.isSymbolicLink()
              ? 'symlink'
              : 'other',
        size: stats.size,
        sizeHuman: this.formatBytes(stats.size),
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString(),
        permissions: stats.mode.toString(8).slice(-3),
        isReadable: !!(stats.mode & 0o400),
        isWritable: !!(stats.mode & 0o200),
        isExecutable: !!(stats.mode & 0o100),
      };

      return {
        success: true,
        output: JSON.stringify(output, null, 2),
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `Failed to get file stats: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

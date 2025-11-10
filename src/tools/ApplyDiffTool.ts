/**
 * Apply Diff Tool - Apply unified diff patches
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateFilePath } from '../utils/validation.js';

const execAsync = promisify(exec);

export class ApplyDiffTool implements ITool {
  name = 'apply_diff';
  description = 'Apply a unified diff patch to files';
  parameters: Record<string, ToolParameter> = {
    diff: {
      type: 'string',
      description: 'Unified diff content',
      required: true,
    },
    targetPath: {
      type: 'string',
      description: 'Target file or directory',
      required: false,
      default: '.',
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const diff = params.diff;
      const targetPath = params.targetPath || '.';

      // Validate path
      const validation = validateFilePath(targetPath);
      if (!validation.valid) {
        return {
          success: false,
          output: '',
          errorMessage: validation.errors.join(', '),
          executionTime: Date.now() - startTime,
        };
      }

      // Create temporary diff file
      const tempDiffPath = path.join('/tmp', `diff-${Date.now()}.patch`);
      await fs.writeFile(tempDiffPath, diff, 'utf-8');

      try {
        // Apply patch
        const { stdout, stderr } = await execAsync(
          `patch -p0 -d "${targetPath}" < "${tempDiffPath}"`,
          {
            timeout: 10000,
          }
        );

        // Clean up temp file
        await fs.unlink(tempDiffPath);

        return {
          success: true,
          output: stdout + (stderr ? `\nStderr: ${stderr}` : ''),
          executionTime: Date.now() - startTime,
        };
      } catch (error: any) {
        // Clean up temp file
        await fs.unlink(tempDiffPath);
        throw error;
      }
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || '',
        errorMessage: `Failed to apply diff: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

/**
 * Write File Tool with safety features
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateFilePath, sanitizeFilePath } from '../utils/validation.js';
import { globalBackupManager } from '../utils/backup-manager.js';
import { globalSyntaxValidator } from '../utils/syntax-validator.js';

export class WriteFileTool implements ITool {
  name = 'write_file';
  description = 'Create or overwrite a file with content (includes automatic backup and syntax validation)';
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
    validate: {
      type: 'boolean',
      description: 'Validate syntax before writing (default: true)',
      required: false,
    },
    backup: {
      type: 'boolean',
      description: 'Create backup before writing (default: true)',
      required: false,
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();
    const shouldValidate = params.validate !== false;
    const shouldBackup = params.backup !== false;

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

      // Check if file exists for backup
      let fileExists = false;
      try {
        await fs.access(filePath);
        fileExists = true;
      } catch {
        // File doesn't exist, no backup needed
      }

      // Validate syntax if requested
      if (shouldValidate) {
        const syntaxResult = await globalSyntaxValidator.validateFile(filePath, params.content);

        if (!syntaxResult.valid) {
          const errorMsg = globalSyntaxValidator.formatValidationResult(syntaxResult);
          return {
            success: false,
            output: '',
            errorMessage: `Syntax validation failed:\n${errorMsg}`,
            executionTime: Date.now() - startTime,
          };
        }
      }

      // Create backup if file exists and backup is requested
      let backupPath: string | undefined;
      if (fileExists && shouldBackup) {
        const backup = await globalBackupManager.createBackup(filePath, 'write_file operation');
        if (backup) {
          backupPath = backup.backupPath;
        }
      }

      // Create directory if it doesn't exist
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, params.content, 'utf-8');

      // Record change
      globalBackupManager.recordChange({
        filePath,
        operation: 'write',
        backupPath,
        newContent: params.content,
        success: true,
      });

      let output = `✓ File written successfully: ${filePath}`;
      if (backupPath) {
        output += `\n✓ Backup created: ${backupPath}`;
      }
      if (shouldValidate) {
        output += '\n✓ Syntax validation passed';
      }

      return {
        success: true,
        output,
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

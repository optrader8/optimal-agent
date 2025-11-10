/**
 * SED Tool - Stream editor for text transformation
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validateFilePath } from '../utils/validation.js';

const execAsync = promisify(exec);

export class SedTool implements ITool {
  name = 'sed';
  description = 'Stream editor for filtering and transforming text';
  parameters: Record<string, ToolParameter> = {
    script: {
      type: 'string',
      description: 'SED script to execute',
      required: true,
    },
    file: {
      type: 'string',
      description: 'File to process',
      required: true,
    },
    inPlace: {
      type: 'boolean',
      description: 'Edit file in place',
      required: false,
      default: false,
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Validate file
      const validation = validateFilePath(params.file);
      if (!validation.valid) {
        return {
          success: false,
          output: '',
          errorMessage: validation.errors.join(', '),
          executionTime: Date.now() - startTime,
        };
      }

      const script = params.script;
      const file = params.file;
      const inPlace = params.inPlace || false;

      // Build sed command
      let command = 'sed';

      if (inPlace) {
        command += " -i ''";
      }

      command += ` '${script.replace(/'/g, "'\\''")}' "${file}"`;

      const { stdout, stderr } = await execAsync(command);

      return {
        success: true,
        output: inPlace
          ? `File modified in place: ${file}`
          : stdout + (stderr ? `\nStderr: ${stderr}` : ''),
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `sed failed: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

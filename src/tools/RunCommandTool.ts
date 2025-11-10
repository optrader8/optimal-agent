/**
 * Run Command Tool
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validateCommand } from '../utils/validation.js';

const execAsync = promisify(exec);

export class RunCommandTool implements ITool {
  name = 'run_command';
  description = 'Execute a shell command';
  parameters: Record<string, ToolParameter } = {
    command: {
      type: 'string',
      description: 'Command to execute',
      required: true,
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Validate command
      const validation = validateCommand(params.command);
      if (!validation.valid) {
        return {
          success: false,
          output: '',
          errorMessage: validation.errors.join(', '),
          executionTime: Date.now() - startTime,
        };
      }

      // Execute command with timeout
      const { stdout, stderr } = await execAsync(params.command, {
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB max buffer
      });

      return {
        success: true,
        output: stdout + (stderr ? `\nStderr:\n${stderr}` : ''),
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || '',
        errorMessage: `Command failed: ${error.message}${error.stderr ? '\n' + error.stderr : ''}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

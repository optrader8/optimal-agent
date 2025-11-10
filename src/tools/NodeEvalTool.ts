/**
 * Node.js Code Evaluation Tool
 * Allows executing Node.js code snippets, including fs operations
 */

import { ITool, ToolParameter } from '../interfaces/ITool.js';
import { ToolResult } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

export class NodeEvalTool implements ITool {
  name = 'node_eval';
  description = 'Execute Node.js code (e.g., fs.stat(), path operations)';
  parameters: Record<string, ToolParameter> = {
    code: {
      type: 'string',
      description: 'Node.js code to execute',
      required: true,
    },
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const code = params.code;

      // Security check: block dangerous operations
      const dangerousPatterns = [
        'require\\s*\\(',
        'import\\s+',
        'eval\\s*\\(',
        'Function\\s*\\(',
        'process\\.exit',
        'child_process',
        'exec',
        'spawn',
      ];

      for (const pattern of dangerousPatterns) {
        if (new RegExp(pattern, 'i').test(code)) {
          return {
            success: false,
            output: '',
            errorMessage: `Security: Code contains potentially dangerous operation: ${pattern}`,
            executionTime: Date.now() - startTime,
          };
        }
      }

      // Create a safe execution context with common Node.js modules
      const context = {
        fs: fs,
        fsPromises: fs.promises,
        path: path,
        console: {
          log: (...args: any[]) => args.join(' '),
        },
        JSON: JSON,
        Math: Math,
        Date: Date,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
      };

      // Wrap code in async function for await support
      const wrappedCode = `
        (async function() {
          const { fs, fsPromises, path, console, JSON, Math, Date } = this;
          ${code}
        }).call(context)
      `;

      // Execute code
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction('context', wrappedCode);
      const result = await fn(context);

      // Convert result to string
      let output: string;
      if (result === undefined) {
        output = 'undefined';
      } else if (typeof result === 'object') {
        output = JSON.stringify(result, null, 2);
      } else {
        output = String(result);
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
        errorMessage: `Code execution failed: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

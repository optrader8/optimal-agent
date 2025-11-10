/**
 * Find Symbol Tool
 * Finds functions, classes, variables, and other symbols in code
 */

import { ITool, ToolResult } from '../interfaces/ITool.js';
import { TypeScriptParser, SymbolInfo } from '../analysis/TypeScriptParser.js';
import fs from 'fs/promises';
import path from 'path';
// @ts-ignore - glob doesn't have types in this version
import glob from 'glob';
import { promisify } from 'util';

const globAsync = promisify(glob) as (pattern: string, options?: any) => Promise<string[]>;

export interface FindSymbolParams {
  name: string; // Symbol name to search for (supports partial match)
  kind?: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const' | 'method' | 'property' | 'enum';
  directory?: string; // Directory to search in (default: current directory)
  filePattern?: string; // File pattern to search (default: **/*.{ts,tsx,js,jsx})
  useRegex?: boolean; // Treat name as regex pattern
  caseSensitive?: boolean; // Case sensitive search (default: false)
}

export class FindSymbolTool implements ITool {
  name = 'find_symbol';
  description = 'Find functions, classes, variables, and other symbols in TypeScript/JavaScript code';
  parameters = this.getParameters();

  private parser: TypeScriptParser;

  constructor() {
    this.parser = new TypeScriptParser();
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const {
        name,
        kind,
        directory = '.',
        filePattern = '**/*.{ts,tsx,js,jsx}',
        useRegex = false,
        caseSensitive = false,
      } = params as FindSymbolParams;

      if (!name) {
        return {
          success: false,
          output: '',
          errorMessage: 'Parameter "name" is required',
          executionTime: Date.now() - startTime,
        };
      }

      // Get all matching files
      const files = await globAsync(filePattern, {
        cwd: directory,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      });

      if (files.length === 0) {
        return {
          success: true,
          output: `No files found matching pattern: ${filePattern}`,
          executionTime: Date.now() - startTime,
        };
      }

      // Search for symbols in all files
      const allResults: Array<{ file: string; symbols: SymbolInfo[] }> = [];
      let totalSymbols = 0;

      for (const file of files) {
        try {
          const structure = await this.parser.parseFile(file);

          // Search based on parameters
          let symbols: SymbolInfo[];

          if (useRegex) {
            const flags = caseSensitive ? '' : 'i';
            const pattern = new RegExp(name, flags);
            symbols = this.parser.findSymbolsByPattern(structure, pattern, kind);
          } else {
            symbols = this.parser.findSymbols(structure, name, kind);

            // Filter for case sensitivity
            if (caseSensitive) {
              symbols = symbols.filter(s => s.name.includes(name));
            }
          }

          if (symbols.length > 0) {
            allResults.push({ file, symbols });
            totalSymbols += symbols.length;
          }
        } catch (error) {
          // Skip files that can't be parsed
          continue;
        }
      }

      if (totalSymbols === 0) {
        return {
          success: true,
          output: `No symbols found matching "${name}"${kind ? ` of kind "${kind}"` : ''}`,
          executionTime: Date.now() - startTime,
        };
      }

      // Format results
      let output = `Found ${totalSymbols} symbol(s) in ${allResults.length} file(s):\n\n`;

      for (const { file, symbols } of allResults) {
        const relativePath = path.relative(process.cwd(), file);
        output += `📄 ${relativePath}\n`;

        for (const symbol of symbols) {
          const kindIcon = this.getKindIcon(symbol.kind);
          const location = `${symbol.line}:${symbol.column}`;
          const signature = symbol.signature || symbol.name;
          const parent = symbol.parent ? ` (in ${symbol.parent})` : '';

          output += `  ${kindIcon} ${location} - ${signature}${parent}\n`;

          if (symbol.documentation) {
            output += `     ${symbol.documentation}\n`;
          }
        }

        output += '\n';
      }

      // Add summary
      output += this.generateSummary(allResults);

      return {
        success: true,
        output,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        errorMessage: `Failed to find symbols: ${error.message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get icon for symbol kind
   */
  private getKindIcon(kind: SymbolInfo['kind']): string {
    const icons: Record<SymbolInfo['kind'], string> = {
      function: '🔧',
      class: '🏛️',
      interface: '📋',
      type: '🏷️',
      variable: '📦',
      const: '🔒',
      method: '⚙️',
      property: '🔹',
      enum: '📊',
    };

    return icons[kind] || '•';
  }

  /**
   * Generate summary
   */
  private generateSummary(results: Array<{ file: string; symbols: SymbolInfo[] }>): string {
    const kindCounts: Record<string, number> = {};

    for (const { symbols } of results) {
      for (const symbol of symbols) {
        kindCounts[symbol.kind] = (kindCounts[symbol.kind] || 0) + 1;
      }
    }

    let summary = 'Summary by type:\n';
    for (const [kind, count] of Object.entries(kindCounts).sort((a, b) => b[1] - a[1])) {
      summary += `  ${this.getKindIcon(kind as SymbolInfo['kind'])} ${kind}: ${count}\n`;
    }

    return summary;
  }

  getParameters() {
    return {
      name: {
        type: 'string' as const,
        description: 'Symbol name to search for (supports partial match)',
        required: true,
      },
      kind: {
        type: 'string' as const,
        description: 'Symbol kind to filter by (function, class, interface, type, variable, const, method, property, enum)',
        required: false,
      },
      directory: {
        type: 'string' as const,
        description: 'Directory to search in (default: current directory)',
        required: false,
      },
      filePattern: {
        type: 'string' as const,
        description: 'File pattern to search (default: **/*.{ts,tsx,js,jsx})',
        required: false,
      },
      useRegex: {
        type: 'boolean' as const,
        description: 'Treat name as regex pattern (default: false)',
        required: false,
      },
      caseSensitive: {
        type: 'boolean' as const,
        description: 'Case sensitive search (default: false)',
        required: false,
      },
    };
  }

  getExamples(): string[] {
    return [
      'Find all functions named "parse": { "name": "parse", "kind": "function" }',
      'Find all classes containing "Manager": { "name": "Manager", "kind": "class" }',
      'Find symbols using regex: { "name": "^get.*", "useRegex": true }',
      'Find in specific directory: { "name": "Config", "directory": "./src/config" }',
    ];
  }
}

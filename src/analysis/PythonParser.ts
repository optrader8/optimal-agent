/**
 * Python AST Parser
 * Parses Python code using Python's ast module
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { SymbolInfo } from './TypeScriptParser.js';

const execAsync = promisify(exec);

export class PythonParser {
  /**
   * Parse a Python file
   */
  async parseFile(filePath: string): Promise<SymbolInfo[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parseCode(content, filePath);
  }

  /**
   * Parse Python code using Python's ast module
   */
  async parseCode(code: string, filePath: string = 'temp.py'): Promise<SymbolInfo[]> {
    try {
      // Create temporary Python script to parse AST
      const tempFile = `/tmp/parse-py-${Date.now()}.py`;
      await fs.writeFile(tempFile, code, 'utf-8');

      // Python script to extract symbols
      const pythonScript = `
import ast
import json
import sys

def extract_symbols(filename):
    with open(filename, 'r') as f:
        code = f.read()

    try:
        tree = ast.parse(code, filename=filename)
    except SyntaxError as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

    symbols = []

    for node in ast.walk(tree):
        symbol = None

        # Function definitions
        if isinstance(node, ast.FunctionDef):
            args = [arg.arg for arg in node.args.args]
            signature = f"def {node.name}({', '.join(args)})"

            # Check for decorators
            decorators = [d.id if isinstance(d, ast.Name) else str(d) for d in node.decorator_list]

            symbol = {
                'name': node.name,
                'kind': 'function',
                'line': node.lineno,
                'column': node.col_offset + 1,
                'endLine': node.end_lineno or node.lineno,
                'endColumn': (node.end_col_offset or 0) + 1,
                'signature': signature,
                'modifiers': decorators
            }

            # Extract docstring
            if (isinstance(node.body[0], ast.Expr) and
                isinstance(node.body[0].value, ast.Constant) and
                isinstance(node.body[0].value.value, str)):
                symbol['documentation'] = node.body[0].value.value.strip()

        # Class definitions
        elif isinstance(node, ast.ClassDef):
            bases = [b.id if isinstance(b, ast.Name) else str(b) for b in node.bases]
            signature = f"class {node.name}"
            if bases:
                signature += f"({', '.join(bases)})"

            symbol = {
                'name': node.name,
                'kind': 'class',
                'line': node.lineno,
                'column': node.col_offset + 1,
                'endLine': node.end_lineno or node.lineno,
                'endColumn': (node.end_col_offset or 0) + 1,
                'signature': signature
            }

            # Extract docstring
            if (isinstance(node.body[0], ast.Expr) and
                isinstance(node.body[0].value, ast.Constant) and
                isinstance(node.body[0].value.value, str)):
                symbol['documentation'] = node.body[0].value.value.strip()

        # Variable assignments (module level or class level)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    symbol = {
                        'name': target.id,
                        'kind': 'variable',
                        'line': node.lineno,
                        'column': node.col_offset + 1,
                        'endLine': node.end_lineno or node.lineno,
                        'endColumn': (node.end_col_offset or 0) + 1,
                        'signature': f"{target.id} = ..."
                    }
                    symbols.append(symbol)

        if symbol:
            symbols.append(symbol)

    print(json.dumps(symbols, indent=2))

if __name__ == '__main__':
    extract_symbols('${tempFile}')
`;

      // Execute Python script
      const { stdout, stderr } = await execAsync(`python3 -c ${JSON.stringify(pythonScript)}`, {
        timeout: 10000,
      });

      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {});

      if (stderr && !stdout) {
        throw new Error(`Python parsing failed: ${stderr}`);
      }

      // Parse JSON output
      const result = JSON.parse(stdout);

      if (result.error) {
        throw new Error(`Python syntax error: ${result.error}`);
      }

      // Convert to SymbolInfo format
      const symbols: SymbolInfo[] = result.map((sym: any) => ({
        ...sym,
        filePath,
        modifiers: sym.modifiers || [],
      }));

      return symbols;
    } catch (error: any) {
      // If Python is not available, return empty array
      if (error.message.includes('python3')) {
        console.warn('Python 3 is not available. Skipping Python parsing.');
        return [];
      }
      throw error;
    }
  }

  /**
   * Find symbols by name
   */
  findSymbols(symbols: SymbolInfo[], name: string, kind?: SymbolInfo['kind']): SymbolInfo[] {
    return symbols.filter(symbol => {
      const nameMatch = symbol.name.toLowerCase().includes(name.toLowerCase());
      const kindMatch = !kind || symbol.kind === kind;
      return nameMatch && kindMatch;
    });
  }

  /**
   * Find symbols by pattern (regex)
   */
  findSymbolsByPattern(symbols: SymbolInfo[], pattern: RegExp, kind?: SymbolInfo['kind']): SymbolInfo[] {
    return symbols.filter(symbol => {
      const nameMatch = pattern.test(symbol.name);
      const kindMatch = !kind || symbol.kind === kind;
      return nameMatch && kindMatch;
    });
  }

  /**
   * Get all functions
   */
  getAllFunctions(symbols: SymbolInfo[]): SymbolInfo[] {
    return symbols.filter(s => s.kind === 'function');
  }

  /**
   * Get all classes
   */
  getAllClasses(symbols: SymbolInfo[]): SymbolInfo[] {
    return symbols.filter(s => s.kind === 'class');
  }
}

// Global Python parser instance
export const globalPythonParser = new PythonParser();

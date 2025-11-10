/**
 * TypeScript/JavaScript AST Parser
 * Parses code using TypeScript Compiler API
 */

import ts from 'typescript';
import fs from 'fs/promises';
import path from 'path';

export interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const' | 'method' | 'property' | 'enum';
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  filePath: string;
  signature?: string;
  documentation?: string;
  modifiers?: string[];
  parent?: string;
}

export interface ImportInfo {
  source: string;
  imports: string[];
  isDefault: boolean;
  line: number;
}

export interface CodeStructure {
  symbols: SymbolInfo[];
  imports: ImportInfo[];
  exports: string[];
}

export class TypeScriptParser {
  /**
   * Parse a TypeScript/JavaScript file
   */
  async parseFile(filePath: string): Promise<CodeStructure> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parseCode(content, filePath);
  }

  /**
   * Parse TypeScript/JavaScript code
   */
  parseCode(code: string, filePath: string = 'temp.ts'): CodeStructure {
    const sourceFile = ts.createSourceFile(
      filePath,
      code,
      ts.ScriptTarget.Latest,
      true,
      path.extname(filePath) === '.tsx' || path.extname(filePath) === '.jsx'
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS
    );

    const symbols: SymbolInfo[] = [];
    const imports: ImportInfo[] = [];
    const exports: string[] = [];

    const visit = (node: ts.Node, parent?: string) => {
      // Function declarations
      if (ts.isFunctionDeclaration(node) && node.name) {
        symbols.push(this.extractFunctionInfo(node, sourceFile, filePath, parent));
      }

      // Class declarations
      if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.text;
        symbols.push(this.extractClassInfo(node, sourceFile, filePath));

        // Visit class members
        node.members.forEach(member => {
          if (ts.isMethodDeclaration(member) && member.name) {
            symbols.push(this.extractMethodInfo(member, sourceFile, filePath, className));
          }
          if (ts.isPropertyDeclaration(member) && member.name) {
            symbols.push(this.extractPropertyInfo(member, sourceFile, filePath, className));
          }
        });
      }

      // Interface declarations
      if (ts.isInterfaceDeclaration(node)) {
        symbols.push(this.extractInterfaceInfo(node, sourceFile, filePath));
      }

      // Type alias declarations
      if (ts.isTypeAliasDeclaration(node)) {
        symbols.push(this.extractTypeAliasInfo(node, sourceFile, filePath));
      }

      // Enum declarations
      if (ts.isEnumDeclaration(node)) {
        symbols.push(this.extractEnumInfo(node, sourceFile, filePath));
      }

      // Variable declarations
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach(decl => {
          if (ts.isIdentifier(decl.name)) {
            symbols.push(this.extractVariableInfo(decl, node, sourceFile, filePath));
          }
        });
      }

      // Import declarations
      if (ts.isImportDeclaration(node)) {
        imports.push(this.extractImportInfo(node, sourceFile));
      }

      // Export declarations
      if (ts.canHaveModifiers(node)) {
        const modifiers = ts.getModifiers(node);
        if (modifiers?.some((m: ts.Modifier) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          const name = this.getNodeName(node);
          if (name) {
            exports.push(name);
          }
        }
      }

      // Continue visiting child nodes
      ts.forEachChild(node, child => visit(child, parent));
    };

    visit(sourceFile);

    return { symbols, imports, exports };
  }

  /**
   * Extract function information
   */
  private extractFunctionInfo(
    node: ts.FunctionDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string,
    parent?: string
  ): SymbolInfo {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    const modifiers = node.modifiers?.map(m => ts.SyntaxKind[m.kind].toLowerCase()) || [];
    const isAsync = modifiers.includes('asynckeyword');
    const signature = this.getFunctionSignature(node, isAsync);

    return {
      name: node.name!.text,
      kind: 'function',
      line: line + 1,
      column: character + 1,
      endLine: endLine + 1,
      endColumn: endColumn + 1,
      filePath,
      signature,
      modifiers,
      parent,
      documentation: this.getDocumentation(node, sourceFile),
    };
  }

  /**
   * Extract class information
   */
  private extractClassInfo(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string
  ): SymbolInfo {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    const modifiers = node.modifiers?.map(m => ts.SyntaxKind[m.kind].toLowerCase()) || [];
    const heritage = node.heritageClauses
      ?.map(clause =>
        clause.types.map(t => t.expression.getText(sourceFile)).join(', ')
      )
      .join(', ');

    const signature = `class ${node.name!.text}${heritage ? ` extends/implements ${heritage}` : ''}`;

    return {
      name: node.name!.text,
      kind: 'class',
      line: line + 1,
      column: character + 1,
      endLine: endLine + 1,
      endColumn: endColumn + 1,
      filePath,
      signature,
      modifiers,
      documentation: this.getDocumentation(node, sourceFile),
    };
  }

  /**
   * Extract method information
   */
  private extractMethodInfo(
    node: ts.MethodDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string,
    className: string
  ): SymbolInfo {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    const modifiers = node.modifiers?.map(m => ts.SyntaxKind[m.kind].toLowerCase()) || [];
    const isAsync = modifiers.includes('asynckeyword');
    const isStatic = modifiers.includes('statickeyword');

    const name = node.name.getText(sourceFile);
    const signature = this.getMethodSignature(node, isAsync, isStatic);

    return {
      name,
      kind: 'method',
      line: line + 1,
      column: character + 1,
      endLine: endLine + 1,
      endColumn: endColumn + 1,
      filePath,
      signature,
      modifiers,
      parent: className,
      documentation: this.getDocumentation(node, sourceFile),
    };
  }

  /**
   * Extract property information
   */
  private extractPropertyInfo(
    node: ts.PropertyDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string,
    className: string
  ): SymbolInfo {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    const modifiers = node.modifiers?.map(m => ts.SyntaxKind[m.kind].toLowerCase()) || [];
    const name = node.name.getText(sourceFile);
    const type = node.type?.getText(sourceFile) || 'any';

    return {
      name,
      kind: 'property',
      line: line + 1,
      column: character + 1,
      endLine: endLine + 1,
      endColumn: endColumn + 1,
      filePath,
      signature: `${name}: ${type}`,
      modifiers,
      parent: className,
    };
  }

  /**
   * Extract interface information
   */
  private extractInterfaceInfo(
    node: ts.InterfaceDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string
  ): SymbolInfo {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    const heritage = node.heritageClauses
      ?.map(clause =>
        clause.types.map(t => t.expression.getText(sourceFile)).join(', ')
      )
      .join(', ');

    const signature = `interface ${node.name.text}${heritage ? ` extends ${heritage}` : ''}`;

    return {
      name: node.name.text,
      kind: 'interface',
      line: line + 1,
      column: character + 1,
      endLine: endLine + 1,
      endColumn: endColumn + 1,
      filePath,
      signature,
      documentation: this.getDocumentation(node, sourceFile),
    };
  }

  /**
   * Extract type alias information
   */
  private extractTypeAliasInfo(
    node: ts.TypeAliasDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string
  ): SymbolInfo {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    const typeText = node.type.getText(sourceFile);
    const signature = `type ${node.name.text} = ${typeText}`;

    return {
      name: node.name.text,
      kind: 'type',
      line: line + 1,
      column: character + 1,
      endLine: endLine + 1,
      endColumn: endColumn + 1,
      filePath,
      signature,
      documentation: this.getDocumentation(node, sourceFile),
    };
  }

  /**
   * Extract enum information
   */
  private extractEnumInfo(
    node: ts.EnumDeclaration,
    sourceFile: ts.SourceFile,
    filePath: string
  ): SymbolInfo {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    const members = node.members.map(m => m.name.getText(sourceFile)).join(', ');
    const signature = `enum ${node.name.text} { ${members} }`;

    return {
      name: node.name.text,
      kind: 'enum',
      line: line + 1,
      column: character + 1,
      endLine: endLine + 1,
      endColumn: endColumn + 1,
      filePath,
      signature,
      documentation: this.getDocumentation(node, sourceFile),
    };
  }

  /**
   * Extract variable information
   */
  private extractVariableInfo(
    decl: ts.VariableDeclaration,
    stmt: ts.VariableStatement,
    sourceFile: ts.SourceFile,
    filePath: string
  ): SymbolInfo {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(decl.getStart());
    const { line: endLine, character: endColumn } = sourceFile.getLineAndCharacterOfPosition(decl.getEnd());

    const isConst = stmt.declarationList.flags & ts.NodeFlags.Const;
    const name = (decl.name as ts.Identifier).text;
    const type = decl.type?.getText(sourceFile) || 'any';

    return {
      name,
      kind: isConst ? 'const' : 'variable',
      line: line + 1,
      column: character + 1,
      endLine: endLine + 1,
      endColumn: endColumn + 1,
      filePath,
      signature: `${isConst ? 'const' : 'let/var'} ${name}: ${type}`,
      modifiers: stmt.modifiers?.map(m => ts.SyntaxKind[m.kind].toLowerCase()) || [],
    };
  }

  /**
   * Extract import information
   */
  private extractImportInfo(node: ts.ImportDeclaration, sourceFile: ts.SourceFile): ImportInfo {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const source = (node.moduleSpecifier as ts.StringLiteral).text;

    const imports: string[] = [];
    let isDefault = false;

    if (node.importClause) {
      // Default import
      if (node.importClause.name) {
        imports.push(node.importClause.name.text);
        isDefault = true;
      }

      // Named imports
      if (node.importClause.namedBindings) {
        if (ts.isNamedImports(node.importClause.namedBindings)) {
          node.importClause.namedBindings.elements.forEach(el => {
            imports.push(el.name.text);
          });
        }
        // Namespace import
        if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          imports.push(`* as ${node.importClause.namedBindings.name.text}`);
        }
      }
    }

    return {
      source,
      imports,
      isDefault,
      line: line + 1,
    };
  }

  /**
   * Get function signature
   */
  private getFunctionSignature(node: ts.FunctionDeclaration, isAsync: boolean): string {
    const name = node.name?.text || 'anonymous';
    const params = node.parameters.map(p => p.getText()).join(', ');
    const returnType = node.type?.getText() || 'any';
    const asyncKeyword = isAsync ? 'async ' : '';

    return `${asyncKeyword}function ${name}(${params}): ${returnType}`;
  }

  /**
   * Get method signature
   */
  private getMethodSignature(node: ts.MethodDeclaration, isAsync: boolean, isStatic: boolean): string {
    const name = node.name.getText();
    const params = node.parameters.map(p => p.getText()).join(', ');
    const returnType = node.type?.getText() || 'any';
    const asyncKeyword = isAsync ? 'async ' : '';
    const staticKeyword = isStatic ? 'static ' : '';

    return `${staticKeyword}${asyncKeyword}${name}(${params}): ${returnType}`;
  }

  /**
   * Get JSDoc documentation
   */
  private getDocumentation(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
    const fullText = sourceFile.getFullText();
    const nodeStart = node.getFullStart();
    const trivia = fullText.substring(nodeStart, node.getStart(sourceFile));

    // Extract JSDoc comments
    const jsdocMatch = trivia.match(/\/\*\*([\s\S]*?)\*\//);
    if (jsdocMatch) {
      return jsdocMatch[1]
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(line => line)
        .join(' ');
    }

    return undefined;
  }

  /**
   * Get node name
   */
  private getNodeName(node: ts.Node): string | undefined {
    const namedNode = node as any;
    if (namedNode.name && ts.isIdentifier(namedNode.name as ts.Node)) {
      return (namedNode.name as ts.Identifier).text;
    }
    return undefined;
  }

  /**
   * Find symbols by name
   */
  findSymbols(structure: CodeStructure, name: string, kind?: SymbolInfo['kind']): SymbolInfo[] {
    return structure.symbols.filter(symbol => {
      const nameMatch = symbol.name.toLowerCase().includes(name.toLowerCase());
      const kindMatch = !kind || symbol.kind === kind;
      return nameMatch && kindMatch;
    });
  }

  /**
   * Find symbols by pattern (regex)
   */
  findSymbolsByPattern(structure: CodeStructure, pattern: RegExp, kind?: SymbolInfo['kind']): SymbolInfo[] {
    return structure.symbols.filter(symbol => {
      const nameMatch = pattern.test(symbol.name);
      const kindMatch = !kind || symbol.kind === kind;
      return nameMatch && kindMatch;
    });
  }

  /**
   * Get all function names
   */
  getAllFunctions(structure: CodeStructure): SymbolInfo[] {
    return structure.symbols.filter(s => s.kind === 'function' || s.kind === 'method');
  }

  /**
   * Get all classes
   */
  getAllClasses(structure: CodeStructure): SymbolInfo[] {
    return structure.symbols.filter(s => s.kind === 'class');
  }

  /**
   * Get all interfaces
   */
  getAllInterfaces(structure: CodeStructure): SymbolInfo[] {
    return structure.symbols.filter(s => s.kind === 'interface');
  }

  /**
   * Get class members
   */
  getClassMembers(structure: CodeStructure, className: string): SymbolInfo[] {
    return structure.symbols.filter(s => s.parent === className);
  }
}

// Global TypeScript parser instance
export const globalTypeScriptParser = new TypeScriptParser();

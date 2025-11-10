/**
 * File Tracker
 * Tracks file access patterns, dependencies, and working sets
 */

import { TypeScriptParser } from '../analysis/TypeScriptParser.js';
import { PythonParser } from '../analysis/PythonParser.js';
import fs from 'fs/promises';
import path from 'path';

export interface FileAccessInfo {
  filePath: string;
  accessCount: number;
  lastAccessed: Date;
  firstAccessed: Date;
  operation: 'read' | 'write' | 'edit';
}

export interface FileDependency {
  filePath: string;
  importedBy: Set<string>;
  imports: Set<string>;
  dependencyScore: number; // How central this file is in the dependency graph
}

export interface WorkingSet {
  files: Set<string>;
  score: number;
  lastUpdated: Date;
}

export interface FileSuggestion {
  filePath: string;
  reason: string;
  confidence: number;
}

export class FileTracker {
  private accessLog: Map<string, FileAccessInfo> = new Map();
  private dependencies: Map<string, FileDependency> = new Map();
  private workingSet: WorkingSet = {
    files: new Set(),
    score: 0,
    lastUpdated: new Date(),
  };
  private tsParser: TypeScriptParser;
  private pyParser: PythonParser;
  private maxWorkingSetSize = 20;
  private maxAccessLogSize = 100;

  constructor() {
    this.tsParser = new TypeScriptParser();
    this.pyParser = new PythonParser();
  }

  /**
   * Track file access
   */
  trackAccess(filePath: string, operation: 'read' | 'write' | 'edit'): void {
    const absolutePath = path.resolve(filePath);
    const existing = this.accessLog.get(absolutePath);

    if (existing) {
      existing.accessCount++;
      existing.lastAccessed = new Date();
      existing.operation = operation;
    } else {
      this.accessLog.set(absolutePath, {
        filePath: absolutePath,
        accessCount: 1,
        lastAccessed: new Date(),
        firstAccessed: new Date(),
        operation,
      });
    }

    // Update working set
    this.updateWorkingSet();

    // Cleanup old entries if needed
    if (this.accessLog.size > this.maxAccessLogSize) {
      this.cleanupAccessLog();
    }
  }

  /**
   * Analyze file dependencies
   */
  async analyzeDependencies(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);
    const ext = path.extname(absolutePath);

    try {
      let imports: string[] = [];

      // Parse based on file type
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        const structure = await this.tsParser.parseFile(absolutePath);
        imports = structure.imports
          .map(imp => this.resolveImport(absolutePath, imp.source))
          .filter((imp): imp is string => imp !== null);
      } else if (['.py'].includes(ext)) {
        // Python imports would require additional parsing
        // For now, we'll skip Python dependency analysis
      }

      // Update dependency graph
      const dependency: FileDependency = {
        filePath: absolutePath,
        importedBy: new Set(),
        imports: new Set(imports.filter(Boolean)),
        dependencyScore: 0,
      };

      this.dependencies.set(absolutePath, dependency);

      // Update reverse dependencies
      for (const importedFile of imports) {
        if (importedFile) {
          const importedDep = this.dependencies.get(importedFile);
          if (importedDep) {
            importedDep.importedBy.add(absolutePath);
          } else {
            this.dependencies.set(importedFile, {
              filePath: importedFile,
              importedBy: new Set([absolutePath]),
              imports: new Set(),
              dependencyScore: 0,
            });
          }
        }
      }

      // Recalculate dependency scores
      this.calculateDependencyScores();
    } catch (error) {
      // Skip files that can't be parsed
    }
  }

  /**
   * Resolve import path to absolute file path
   */
  private resolveImport(fromFile: string, importPath: string): string | null {
    // Skip external modules (not starting with . or /)
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null;
    }

    try {
      const dir = path.dirname(fromFile);
      let resolved = path.resolve(dir, importPath);

      // Try different extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
      for (const ext of extensions) {
        const withExt = resolved.endsWith(ext) ? resolved : resolved + ext;
        try {
          // Just return the path, we'll check existence later
          return withExt;
        } catch {
          continue;
        }
      }

      // Try index files
      for (const ext of extensions) {
        try {
          const indexPath = path.join(resolved, `index${ext}`);
          return indexPath;
        } catch {
          continue;
        }
      }

      return resolved;
    } catch {
      return null;
    }
  }

  /**
   * Calculate dependency scores
   */
  private calculateDependencyScores(): void {
    for (const [filePath, dep] of this.dependencies.entries()) {
      // Score based on how many files import this + how many it imports
      const importedByScore = dep.importedBy.size * 2; // Being imported is more important
      const importsScore = dep.imports.size;
      dep.dependencyScore = importedByScore + importsScore;
    }
  }

  /**
   * Update working set based on recent access patterns
   */
  private updateWorkingSet(): void {
    // Get most frequently and recently accessed files
    const candidates = Array.from(this.accessLog.values())
      .sort((a, b) => {
        // Score based on frequency and recency
        const aScore = a.accessCount * 2 + (Date.now() - a.lastAccessed.getTime()) / 1000000;
        const bScore = b.accessCount * 2 + (Date.now() - b.lastAccessed.getTime()) / 1000000;
        return bScore - aScore;
      })
      .slice(0, this.maxWorkingSetSize);

    this.workingSet = {
      files: new Set(candidates.map(c => c.filePath)),
      score: candidates.reduce((sum, c) => sum + c.accessCount, 0),
      lastUpdated: new Date(),
    };
  }

  /**
   * Get current working set
   */
  getWorkingSet(): string[] {
    return Array.from(this.workingSet.files);
  }

  /**
   * Suggest related files based on current context
   */
  suggestRelatedFiles(currentFile: string, limit: number = 5): FileSuggestion[] {
    const absolutePath = path.resolve(currentFile);
    const suggestions: FileSuggestion[] = [];

    // Get dependency for current file
    const currentDep = this.dependencies.get(absolutePath);

    if (currentDep) {
      // Suggest files that this file imports
      for (const imported of currentDep.imports) {
        suggestions.push({
          filePath: imported,
          reason: 'Imported by current file',
          confidence: 0.9,
        });
      }

      // Suggest files that import this file
      for (const importer of currentDep.importedBy) {
        suggestions.push({
          filePath: importer,
          reason: 'Imports current file',
          confidence: 0.8,
        });
      }

      // Suggest related files (share common imports)
      for (const [filePath, dep] of this.dependencies.entries()) {
        if (filePath === absolutePath) continue;

        const commonImports = Array.from(currentDep.imports).filter(imp =>
          dep.imports.has(imp)
        );

        if (commonImports.length > 0) {
          suggestions.push({
            filePath,
            reason: `Shares ${commonImports.length} common imports`,
            confidence: Math.min(0.7, commonImports.length * 0.2),
          });
        }
      }
    }

    // Suggest files in working set
    for (const file of this.workingSet.files) {
      if (file !== absolutePath && !suggestions.find(s => s.filePath === file)) {
        suggestions.push({
          filePath: file,
          reason: 'In current working set',
          confidence: 0.6,
        });
      }
    }

    // Suggest files in same directory
    const currentDir = path.dirname(absolutePath);
    for (const [filePath, _] of this.accessLog.entries()) {
      if (path.dirname(filePath) === currentDir && filePath !== absolutePath) {
        if (!suggestions.find(s => s.filePath === filePath)) {
          suggestions.push({
            filePath,
            reason: 'In same directory',
            confidence: 0.5,
          });
        }
      }
    }

    // Sort by confidence and limit
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Get most frequently accessed files
   */
  getMostAccessedFiles(limit: number = 10): FileAccessInfo[] {
    return Array.from(this.accessLog.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  /**
   * Get most recently accessed files
   */
  getRecentlyAccessedFiles(limit: number = 10): FileAccessInfo[] {
    return Array.from(this.accessLog.values())
      .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
      .slice(0, limit);
  }

  /**
   * Get central files in dependency graph
   */
  getCentralFiles(limit: number = 10): FileDependency[] {
    return Array.from(this.dependencies.values())
      .sort((a, b) => b.dependencyScore - a.dependencyScore)
      .slice(0, limit);
  }

  /**
   * Get file statistics
   */
  getStatistics(): {
    totalFilesTracked: number;
    totalAccesses: number;
    workingSetSize: number;
    dependencyGraphSize: number;
  } {
    return {
      totalFilesTracked: this.accessLog.size,
      totalAccesses: Array.from(this.accessLog.values()).reduce(
        (sum, info) => sum + info.accessCount,
        0
      ),
      workingSetSize: this.workingSet.files.size,
      dependencyGraphSize: this.dependencies.size,
    };
  }

  /**
   * Cleanup old access log entries
   */
  private cleanupAccessLog(): void {
    // Remove least recently accessed files that are not in working set
    const entries = Array.from(this.accessLog.entries())
      .filter(([path, _]) => !this.workingSet.files.has(path))
      .sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());

    // Remove oldest 20%
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.accessLog.delete(entries[i][0]);
    }
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    this.accessLog.clear();
    this.dependencies.clear();
    this.workingSet = {
      files: new Set(),
      score: 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Export tracking data for persistence
   */
  export(): {
    accessLog: Array<[string, FileAccessInfo]>;
    dependencies: Array<[string, { filePath: string; importedBy: string[]; imports: string[]; dependencyScore: number }]>;
    workingSet: { files: string[]; score: number; lastUpdated: string };
  } {
    return {
      accessLog: Array.from(this.accessLog.entries()),
      dependencies: Array.from(this.dependencies.entries()).map(([key, value]) => [
        key,
        {
          filePath: value.filePath,
          importedBy: Array.from(value.importedBy),
          imports: Array.from(value.imports),
          dependencyScore: value.dependencyScore,
        },
      ]),
      workingSet: {
        files: Array.from(this.workingSet.files),
        score: this.workingSet.score,
        lastUpdated: this.workingSet.lastUpdated.toISOString(),
      },
    };
  }

  /**
   * Import tracking data from persistence
   */
  import(data: ReturnType<typeof this.export>): void {
    this.accessLog = new Map(data.accessLog);
    this.dependencies = new Map(
      data.dependencies.map(([key, value]) => [
        key,
        {
          filePath: value.filePath,
          importedBy: new Set(value.importedBy),
          imports: new Set(value.imports),
          dependencyScore: value.dependencyScore,
        },
      ])
    );
    this.workingSet = {
      files: new Set(data.workingSet.files),
      score: data.workingSet.score,
      lastUpdated: new Date(data.workingSet.lastUpdated),
    };
  }
}

// Global file tracker instance
export const globalFileTracker = new FileTracker();

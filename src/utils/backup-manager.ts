/**
 * File Backup and Rollback System
 * Manages file backups and provides rollback capabilities
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface BackupMetadata {
  originalPath: string;
  backupPath: string;
  timestamp: Date;
  hash: string;
  size: number;
  reason?: string;
}

export interface ChangeRecord {
  id: string;
  filePath: string;
  operation: 'write' | 'edit' | 'delete';
  timestamp: Date;
  backupPath?: string;
  originalContent?: string;
  newContent?: string;
  hash: string;
  success: boolean;
}

export class BackupManager {
  private backupDir: string;
  private changeHistory: ChangeRecord[] = [];
  private maxHistorySize: number = 100;

  constructor(backupDir: string = './.backups') {
    this.backupDir = backupDir;
    this.ensureBackupDirectory();
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create backup directory:', error);
    }
  }

  /**
   * Create a backup of a file before modification
   */
  async createBackup(filePath: string, reason?: string): Promise<BackupMetadata | null> {
    try {
      // Check if file exists
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`${filePath} is not a file`);
      }

      // Read original content
      const content = await fs.readFile(filePath, 'utf-8');
      const hash = this.calculateHash(content);

      // Create backup filename with timestamp
      const timestamp = new Date();
      const fileName = path.basename(filePath);
      const backupFileName = `${fileName}.${timestamp.getTime()}.${hash.substring(0, 8)}.bak`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // Write backup
      await fs.writeFile(backupPath, content, 'utf-8');

      const metadata: BackupMetadata = {
        originalPath: filePath,
        backupPath,
        timestamp,
        hash,
        size: stats.size,
        reason,
      };

      console.log(`✓ Backup created: ${backupPath}`);

      return metadata;
    } catch (error: any) {
      console.error(`Failed to create backup for ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Restore a file from backup
   */
  async restoreFromBackup(backupPath: string, targetPath?: string): Promise<boolean> {
    try {
      // Read backup content
      const content = await fs.readFile(backupPath, 'utf-8');

      // Determine target path (use backup metadata or provided path)
      const target = targetPath || this.extractOriginalPath(backupPath);

      if (!target) {
        throw new Error('Could not determine target path for restore');
      }

      // Write to target
      await fs.writeFile(target, content, 'utf-8');

      console.log(`✓ Restored ${target} from ${backupPath}`);

      return true;
    } catch (error: any) {
      console.error(`Failed to restore from backup:`, error.message);
      return false;
    }
  }

  /**
   * Record a file change
   */
  recordChange(change: Omit<ChangeRecord, 'id' | 'timestamp' | 'hash'>): void {
    const record: ChangeRecord = {
      ...change,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      hash: this.calculateHash(change.newContent || ''),
    };

    this.changeHistory.push(record);

    // Limit history size
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory.shift();
    }
  }

  /**
   * Get change history for a specific file
   */
  getFileHistory(filePath: string): ChangeRecord[] {
    return this.changeHistory.filter(record => record.filePath === filePath);
  }

  /**
   * Get all change history
   */
  getAllHistory(limit?: number): ChangeRecord[] {
    if (limit) {
      return this.changeHistory.slice(-limit);
    }
    return [...this.changeHistory];
  }

  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(changeId: string): Promise<boolean> {
    const change = this.changeHistory.find(c => c.id === changeId);

    if (!change) {
      console.error(`Change with ID ${changeId} not found`);
      return false;
    }

    if (!change.backupPath) {
      console.error('No backup available for this change');
      return false;
    }

    return await this.restoreFromBackup(change.backupPath, change.filePath);
  }

  /**
   * Rollback file to its last known state
   */
  async rollbackFile(filePath: string): Promise<boolean> {
    const history = this.getFileHistory(filePath);

    if (history.length === 0) {
      console.error(`No history found for ${filePath}`);
      return false;
    }

    // Find the most recent successful change with a backup
    const lastChange = history.reverse().find(c => c.success && c.backupPath);

    if (!lastChange || !lastChange.backupPath) {
      console.error(`No backup available for ${filePath}`);
      return false;
    }

    return await this.restoreFromBackup(lastChange.backupPath, filePath);
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<string[]> {
    try {
      await this.ensureBackupDirectory();
      const files = await fs.readdir(this.backupDir);
      return files.filter(f => f.endsWith('.bak'));
    } catch (error) {
      return [];
    }
  }

  /**
   * Clean old backups (older than specified days)
   */
  async cleanOldBackups(daysOld: number = 7): Promise<number> {
    try {
      const backups = await this.listBackups();
      const now = Date.now();
      const maxAge = daysOld * 24 * 60 * 60 * 1000;
      let cleaned = 0;

      for (const backup of backups) {
        const backupPath = path.join(this.backupDir, backup);
        const stats = await fs.stat(backupPath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          await fs.unlink(backupPath);
          cleaned++;
        }
      }

      console.log(`✓ Cleaned ${cleaned} old backups`);

      return cleaned;
    } catch (error: any) {
      console.error('Failed to clean old backups:', error.message);
      return 0;
    }
  }

  /**
   * Calculate hash of content
   */
  private calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Extract original path from backup filename
   */
  private extractOriginalPath(backupPath: string): string | null {
    const fileName = path.basename(backupPath);
    const match = fileName.match(/^(.+?)\.\d+\.[a-f0-9]{8}\.bak$/);

    if (match) {
      return match[1];
    }

    return null;
  }

  /**
   * Export change history to JSON
   */
  async exportHistory(outputPath: string): Promise<boolean> {
    try {
      const history = {
        exportDate: new Date().toISOString(),
        totalChanges: this.changeHistory.length,
        changes: this.changeHistory,
      };

      await fs.writeFile(outputPath, JSON.stringify(history, null, 2), 'utf-8');
      console.log(`✓ History exported to ${outputPath}`);

      return true;
    } catch (error: any) {
      console.error('Failed to export history:', error.message);
      return false;
    }
  }
}

// Global backup manager instance
export const globalBackupManager = new BackupManager();

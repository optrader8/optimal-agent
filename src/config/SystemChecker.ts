/**
 * System Requirements Checker
 * Checks system requirements and dependencies
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export interface SystemCheck {
  name: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details?: string;
  required: boolean;
}

export interface SystemRequirements {
  checks: SystemCheck[];
  overallStatus: 'pass' | 'warning' | 'fail';
  canRun: boolean;
}

export class SystemChecker {
  /**
   * Run all system checks
   */
  async checkSystemRequirements(): Promise<SystemRequirements> {
    const checks: SystemCheck[] = [];

    // Check Node.js version
    checks.push(await this.checkNodeVersion());

    // Check available memory
    checks.push(this.checkMemory());

    // Check disk space
    checks.push(await this.checkDiskSpace());

    // Check Ollama installation
    checks.push(await this.checkOllama());

    // Check npm packages
    checks.push(await this.checkNpmPackages());

    // Check TypeScript
    checks.push(await this.checkTypeScript());

    // Check optional tools
    checks.push(await this.checkRipgrep());
    checks.push(await this.checkPython());

    // Determine overall status
    const failedRequired = checks.filter(c => c.required && c.status === 'fail').length;
    const warnings = checks.filter(c => c.status === 'warning').length;

    let overallStatus: 'pass' | 'warning' | 'fail';
    if (failedRequired > 0) {
      overallStatus = 'fail';
    } else if (warnings > 0) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'pass';
    }

    return {
      checks,
      overallStatus,
      canRun: failedRequired === 0,
    };
  }

  /**
   * Check Node.js version
   */
  private async checkNodeVersion(): Promise<SystemCheck> {
    const version = process.version;
    const majorVersion = parseInt(version.slice(1).split('.')[0]);

    if (majorVersion >= 18) {
      return {
        name: 'Node.js Version',
        status: 'pass',
        message: `Node.js ${version} is installed`,
        required: true,
      };
    } else if (majorVersion >= 16) {
      return {
        name: 'Node.js Version',
        status: 'warning',
        message: `Node.js ${version} is installed but version 18+ is recommended`,
        required: true,
      };
    } else {
      return {
        name: 'Node.js Version',
        status: 'fail',
        message: `Node.js ${version} is too old. Version 18+ is required`,
        required: true,
      };
    }
  }

  /**
   * Check available memory
   */
  private checkMemory(): SystemCheck {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const totalGB = (totalMemory / 1024 / 1024 / 1024).toFixed(1);
    const freeGB = (freeMemory / 1024 / 1024 / 1024).toFixed(1);

    if (freeMemory > 2 * 1024 * 1024 * 1024) {
      // More than 2GB free
      return {
        name: 'Available Memory',
        status: 'pass',
        message: `${freeGB}GB free of ${totalGB}GB total`,
        required: true,
      };
    } else if (freeMemory > 1 * 1024 * 1024 * 1024) {
      // More than 1GB free
      return {
        name: 'Available Memory',
        status: 'warning',
        message: `${freeGB}GB free of ${totalGB}GB total (2GB+ recommended)`,
        required: true,
      };
    } else {
      return {
        name: 'Available Memory',
        status: 'fail',
        message: `Only ${freeGB}GB free of ${totalGB}GB total (at least 1GB required)`,
        required: true,
      };
    }
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(): Promise<SystemCheck> {
    try {
      const { stdout } = await execAsync('df -h . | tail -1');
      const parts = stdout.trim().split(/\s+/);
      const available = parts[3];
      const usagePercent = parseInt(parts[4]?.replace('%', '') || '0');

      if (usagePercent < 80) {
        return {
          name: 'Disk Space',
          status: 'pass',
          message: `${available} available (${100 - usagePercent}% free)`,
          required: true,
        };
      } else if (usagePercent < 90) {
        return {
          name: 'Disk Space',
          status: 'warning',
          message: `${available} available (${100 - usagePercent}% free, getting low)`,
          required: true,
        };
      } else {
        return {
          name: 'Disk Space',
          status: 'fail',
          message: `Only ${available} available (${100 - usagePercent}% free)`,
          required: true,
        };
      }
    } catch (error) {
      return {
        name: 'Disk Space',
        status: 'warning',
        message: 'Could not check disk space',
        required: false,
      };
    }
  }

  /**
   * Check Ollama installation
   */
  private async checkOllama(): Promise<SystemCheck> {
    try {
      const { stdout } = await execAsync('ollama --version');
      const version = stdout.trim();

      // Try to connect to Ollama API
      try {
        const { stdout: listOutput } = await execAsync('ollama list', { timeout: 5000 });
        const models = listOutput.split('\n').length - 1;

        return {
          name: 'Ollama',
          status: 'pass',
          message: `Ollama ${version} is installed and running (${models} models available)`,
          details: 'Ollama is accessible at http://localhost:11434',
          required: false,
        };
      } catch {
        return {
          name: 'Ollama',
          status: 'warning',
          message: `Ollama ${version} is installed but not running`,
          details: 'Start Ollama with: ollama serve',
          required: false,
        };
      }
    } catch (error) {
      return {
        name: 'Ollama',
        status: 'warning',
        message: 'Ollama is not installed',
        details: 'Install from: https://ollama.ai/download',
        required: false,
      };
    }
  }

  /**
   * Check npm packages
   */
  private async checkNpmPackages(): Promise<SystemCheck> {
    try {
      await fs.access('./package.json');
      await fs.access('./node_modules');

      return {
        name: 'NPM Packages',
        status: 'pass',
        message: 'Dependencies are installed',
        required: true,
      };
    } catch (error) {
      return {
        name: 'NPM Packages',
        status: 'fail',
        message: 'Dependencies are not installed',
        details: 'Run: npm install',
        required: true,
      };
    }
  }

  /**
   * Check TypeScript
   */
  private async checkTypeScript(): Promise<SystemCheck> {
    try {
      const { stdout } = await execAsync('npx tsc --version');
      const version = stdout.trim();

      return {
        name: 'TypeScript',
        status: 'pass',
        message: `${version} is available`,
        required: true,
      };
    } catch (error) {
      return {
        name: 'TypeScript',
        status: 'fail',
        message: 'TypeScript is not available',
        details: 'Install with: npm install',
        required: true,
      };
    }
  }

  /**
   * Check ripgrep (optional)
   */
  private async checkRipgrep(): Promise<SystemCheck> {
    try {
      const { stdout } = await execAsync('rg --version');
      const version = stdout.split('\n')[0];

      return {
        name: 'ripgrep',
        status: 'pass',
        message: `${version} is installed (optional)`,
        required: false,
      };
    } catch (error) {
      return {
        name: 'ripgrep',
        status: 'warning',
        message: 'ripgrep is not installed (optional but recommended)',
        details: 'Install from: https://github.com/BurntSushi/ripgrep',
        required: false,
      };
    }
  }

  /**
   * Check Python (optional)
   */
  private async checkPython(): Promise<SystemCheck> {
    try {
      const { stdout } = await execAsync('python3 --version');
      const version = stdout.trim();

      return {
        name: 'Python',
        status: 'pass',
        message: `${version} is installed (optional)`,
        required: false,
      };
    } catch (error) {
      return {
        name: 'Python',
        status: 'warning',
        message: 'Python 3 is not installed (optional)',
        details: 'Needed for Python syntax validation',
        required: false,
      };
    }
  }

  /**
   * Format system requirements report
   */
  formatReport(requirements: SystemRequirements): string {
    const statusIcon = {
      pass: '✓',
      warning: '⚠',
      fail: '✗',
    };

    let output = '🔍 System Requirements Check\n';
    output += '=============================\n\n';

    // Group by status
    const required = requirements.checks.filter(c => c.required);
    const optional = requirements.checks.filter(c => !c.required);

    output += 'Required:\n';
    required.forEach(check => {
      const icon = statusIcon[check.status];
      output += `  ${icon} ${check.name}: ${check.message}\n`;
      if (check.details) {
        output += `     ${check.details}\n`;
      }
    });

    output += '\nOptional:\n';
    optional.forEach(check => {
      const icon = statusIcon[check.status];
      output += `  ${icon} ${check.name}: ${check.message}\n`;
      if (check.details) {
        output += `     ${check.details}\n`;
      }
    });

    output += '\n=============================\n';
    output += `Overall Status: ${requirements.overallStatus.toUpperCase()}\n`;

    if (!requirements.canRun) {
      output += '\n⚠️  Some required checks failed. Please resolve them before running.\n';
    } else if (requirements.overallStatus === 'warning') {
      output += '\n⚠️  Some optional features may not be available.\n';
    } else {
      output += '\n✓ All checks passed! System is ready to run.\n';
    }

    return output;
  }
}

// Global system checker instance
export const globalSystemChecker = new SystemChecker();

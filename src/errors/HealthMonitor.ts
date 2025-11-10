/**
 * System Health Monitor
 * Monitors system health and provides diagnostics
 */

import { ErrorCategory, ErrorSeverity } from './ErrorTypes.js';
import { ErrorHandler } from './ErrorHandler.js';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: HealthCheck[];
  metrics: SystemMetrics;
  recommendations: string[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  cpu: {
    cores: number;
    loadAverage: number[];
  };
  uptime: number;
  platform: string;
  nodeVersion: string;
}

export class HealthMonitor {
  private errorHandler: ErrorHandler;
  private healthChecks: Map<string, () => Promise<HealthCheck>> = new Map();

  constructor(errorHandler: ErrorHandler) {
    this.errorHandler = errorHandler;
    this.registerDefaultChecks();
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    this.registerCheck('memory', this.checkMemory.bind(this));
    this.registerCheck('disk', this.checkDiskSpace.bind(this));
    this.registerCheck('error_rate', this.checkErrorRate.bind(this));
    this.registerCheck('dependencies', this.checkDependencies.bind(this));
  }

  /**
   * Register a health check
   */
  registerCheck(name: string, check: () => Promise<HealthCheck>): void {
    this.healthChecks.set(name, check);
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];
    const metrics = await this.getSystemMetrics();

    // Run all registered checks
    for (const [name, checkFn] of this.healthChecks.entries()) {
      try {
        const result = await checkFn();
        checks.push(result);
      } catch (error: any) {
        checks.push({
          name,
          status: 'fail',
          message: `Health check failed: ${error.message}`,
        });
      }
    }

    // Determine overall status
    const failCount = checks.filter(c => c.status === 'fail').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (failCount > 0) {
      overall = 'unhealthy';
    } else if (warningCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(checks, metrics);

    return {
      overall,
      timestamp: new Date(),
      checks,
      metrics,
      recommendations,
    };
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: (usedMem / totalMem) * 100,
      },
      cpu: {
        cores: os.cpus().length,
        loadAverage: os.loadavg(),
      },
      uptime: os.uptime(),
      platform: os.platform(),
      nodeVersion: process.version,
    };
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<HealthCheck> {
    const metrics = await this.getSystemMetrics();
    const usagePercent = metrics.memory.usagePercent;

    if (usagePercent > 90) {
      return {
        name: 'memory',
        status: 'fail',
        message: `Memory usage critical: ${usagePercent.toFixed(1)}%`,
        details: { usagePercent },
      };
    } else if (usagePercent > 75) {
      return {
        name: 'memory',
        status: 'warning',
        message: `Memory usage high: ${usagePercent.toFixed(1)}%`,
        details: { usagePercent },
      };
    }

    return {
      name: 'memory',
      status: 'pass',
      message: `Memory usage normal: ${usagePercent.toFixed(1)}%`,
      details: { usagePercent },
    };
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(): Promise<HealthCheck> {
    try {
      const { stdout } = await execAsync('df -h . | tail -1');
      const parts = stdout.trim().split(/\s+/);
      const usagePercent = parseInt(parts[4]?.replace('%', '') || '0');

      if (usagePercent > 90) {
        return {
          name: 'disk',
          status: 'fail',
          message: `Disk space critical: ${usagePercent}% used`,
          details: { usagePercent },
        };
      } else if (usagePercent > 75) {
        return {
          name: 'disk',
          status: 'warning',
          message: `Disk space low: ${usagePercent}% used`,
          details: { usagePercent },
        };
      }

      return {
        name: 'disk',
        status: 'pass',
        message: `Disk space normal: ${usagePercent}% used`,
        details: { usagePercent },
      };
    } catch (error) {
      return {
        name: 'disk',
        status: 'warning',
        message: 'Could not check disk space',
      };
    }
  }

  /**
   * Check error rate
   */
  private async checkErrorRate(): Promise<HealthCheck> {
    const stats = this.errorHandler.getErrorStatistics();
    const recentErrors = this.errorHandler.getRecentErrors(10);
    const criticalErrors = recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length;

    if (criticalErrors > 3) {
      return {
        name: 'error_rate',
        status: 'fail',
        message: `High critical error rate: ${criticalErrors} in last 10 errors`,
        details: { criticalErrors, totalErrors: stats.total },
      };
    } else if (criticalErrors > 0) {
      return {
        name: 'error_rate',
        status: 'warning',
        message: `Some critical errors detected: ${criticalErrors} in last 10 errors`,
        details: { criticalErrors, totalErrors: stats.total },
      };
    }

    return {
      name: 'error_rate',
      status: 'pass',
      message: `Error rate normal: ${stats.total} total errors`,
      details: { totalErrors: stats.total },
    };
  }

  /**
   * Check dependencies
   */
  private async checkDependencies(): Promise<HealthCheck> {
    const issues: string[] = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (majorVersion < 18) {
      issues.push(`Node.js version ${nodeVersion} is outdated (recommend 18+)`);
    }

    // Check for common dependencies
    try {
      await import('chalk');
    } catch {
      issues.push('Missing dependency: chalk');
    }

    try {
      await import('uuid');
    } catch {
      issues.push('Missing dependency: uuid');
    }

    if (issues.length > 0) {
      return {
        name: 'dependencies',
        status: 'warning',
        message: `Dependency issues found: ${issues.length}`,
        details: { issues },
      };
    }

    return {
      name: 'dependencies',
      status: 'pass',
      message: 'All dependencies OK',
    };
  }

  /**
   * Generate recommendations based on health checks
   */
  private generateRecommendations(checks: HealthCheck[], metrics: SystemMetrics): string[] {
    const recommendations: string[] = [];

    // Memory recommendations
    if (metrics.memory.usagePercent > 75) {
      recommendations.push('Consider restarting the application to free memory');
      recommendations.push('Close unused applications to free system memory');
    }

    // Error pattern recommendations
    const errorStats = this.errorHandler.getErrorStatistics();
    if (errorStats.topPatterns.length > 0) {
      const topPattern = errorStats.topPatterns[0];
      if (topPattern.count > 5) {
        recommendations.push(`Recurring error pattern detected (${topPattern.count} occurrences): ${topPattern.pattern}`);
        recommendations.push('Check the error logs for details and patterns');
      }
    }

    // Failed health checks
    const failedChecks = checks.filter(c => c.status === 'fail');
    if (failedChecks.length > 0) {
      recommendations.push('Address failed health checks immediately');
      failedChecks.forEach(check => {
        recommendations.push(`- ${check.name}: ${check.message}`);
      });
    }

    return recommendations;
  }

  /**
   * Format health status for display
   */
  formatHealthStatus(status: HealthStatus): string {
    const statusIcon = {
      healthy: '✅',
      degraded: '⚠️ ',
      unhealthy: '❌',
    };

    let output = `${statusIcon[status.overall]} System Health: ${status.overall.toUpperCase()}\n`;
    output += `Timestamp: ${status.timestamp.toISOString()}\n\n`;

    // Metrics
    output += '📊 System Metrics:\n';
    output += `  Memory: ${status.metrics.memory.usagePercent.toFixed(1)}% (${(status.metrics.memory.used / 1024 / 1024 / 1024).toFixed(2)}GB used)\n`;
    output += `  CPU: ${status.metrics.cpu.cores} cores, load: ${status.metrics.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}\n`;
    output += `  Uptime: ${(status.metrics.uptime / 3600).toFixed(1)} hours\n\n`;

    // Health checks
    output += '🔍 Health Checks:\n';
    status.checks.forEach(check => {
      const icon = { pass: '✓', warning: '⚠', fail: '✗' }[check.status];
      output += `  ${icon} ${check.name}: ${check.message}\n`;
    });

    // Recommendations
    if (status.recommendations.length > 0) {
      output += '\n💡 Recommendations:\n';
      status.recommendations.forEach((rec, idx) => {
        output += `  ${idx + 1}. ${rec}\n`;
      });
    }

    return output;
  }
}

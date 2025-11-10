/**
 * Setup Script
 * Entry point for the setup wizard
 */

import { ConfigManager, globalConfigManager } from './config/ConfigManager.js';
import { SystemChecker, globalSystemChecker } from './config/SystemChecker.js';
import { SetupWizard } from './config/SetupWizard.js';
import chalk from 'chalk';

async function runSetup() {
  try {
    // Load or create configuration
    await globalConfigManager.loadConfig();

    // Run setup wizard
    const wizard = new SetupWizard(globalConfigManager, globalSystemChecker);
    await wizard.run();

    process.exit(0);
  } catch (error: any) {
    console.error(chalk.red(`\nSetup failed: ${error.message}\n`));
    process.exit(1);
  }
}

runSetup();

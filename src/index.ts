/**
 * Optimal Agent - Main Entry Point
 */

import { ConversationManager } from './agent/ConversationManager.js';
import { LocalModelFactory } from './models/LocalModelFactory.js';
import { NaturalLanguageParser } from './parsers/NaturalLanguageParser.js';
import { ToolExecutor } from './tools/ToolExecutor.js';
import { ContextManager } from './context/ContextManager.js';

// File operation tools
import { ReadFileTool } from './tools/ReadFileTool.js';
import { WriteFileTool } from './tools/WriteFileTool.js';
import { ListDirectoryTool } from './tools/ListDirectoryTool.js';
import { FileTreeTool } from './tools/FileTreeTool.js';
import { FileStatTool } from './tools/FileStatTool.js';

// Search tools
import { GrepSearchTool } from './tools/GrepSearchTool.js';
import { RipgrepTool } from './tools/RipgrepTool.js';
import { FindTool } from './tools/FindTool.js';

// Text processing tools
import { AwkTool } from './tools/AwkTool.js';
import { SedTool } from './tools/SedTool.js';
import { WcTool } from './tools/WcTool.js';

// Code tools
import { GetFileOutlineTool } from './tools/GetFileOutlineTool.js';
import { EditFileTool } from './tools/EditFileTool.js';
import { ApplyDiffTool } from './tools/ApplyDiffTool.js';

// Execution tools
import { RunCommandTool } from './tools/RunCommandTool.js';
import { NodeEvalTool } from './tools/NodeEvalTool.js';

// Testing and diagnostics tools
import { RunTestsTool } from './tools/RunTestsTool.js';
import { GetDiagnosticsTool } from './tools/GetDiagnosticsTool.js';

// Code analysis tools
import { FindSymbolTool } from './tools/FindSymbolTool.js';

import { defaultModelConfig, defaultSystemConfig } from './config.js';
import { ErrorHandler, globalErrorHandler } from './errors/ErrorHandler.js';
import { HealthMonitor } from './errors/HealthMonitor.js';
import { globalBackupManager } from './utils/backup-manager.js';
import { globalConfigManager } from './config/ConfigManager.js';
import { globalSystemChecker } from './config/SystemChecker.js';
import readline from 'readline';
import chalk from 'chalk';

async function main() {
  console.log(chalk.bold.cyan('🤖 Optimal Agent - Local Coding Assistant'));
  console.log(chalk.gray('=====================================\n'));

  // Initialize components
  console.log(chalk.yellow('Initializing components...'));

  // Determine model provider from environment
  const useOpenAI = process.env.USE_OPENAI === 'true';

  if (useOpenAI && (!process.env.OPENAI_BASE_URL || !process.env.OPENAI_API_KEY)) {
    console.error(
      chalk.red('ERROR: USE_OPENAI is true but OPENAI_BASE_URL or OPENAI_API_KEY is not set!')
    );
    console.log(chalk.yellow('Please set these environment variables in your .env file.'));
    process.exit(1);
  }

  const model = useOpenAI
    ? LocalModelFactory.create({
        provider: 'openai',
        baseUrl: process.env.OPENAI_BASE_URL!,
        apiKey: process.env.OPENAI_API_KEY!,
      })
    : LocalModelFactory.create('ollama');

  // Initialize error handling
  const errorHandler = globalErrorHandler;
  const healthMonitor = new HealthMonitor(errorHandler);

  const contextManager = new ContextManager();
  const toolExecutor = new ToolExecutor(errorHandler);

  // Register all tools
  console.log(chalk.yellow('Registering tools...'));

  // File operations
  toolExecutor.registerTool(new ReadFileTool());
  toolExecutor.registerTool(new WriteFileTool());
  toolExecutor.registerTool(new ListDirectoryTool());
  toolExecutor.registerTool(new FileTreeTool());
  toolExecutor.registerTool(new FileStatTool());

  // Search tools
  toolExecutor.registerTool(new GrepSearchTool());
  toolExecutor.registerTool(new RipgrepTool());
  toolExecutor.registerTool(new FindTool());

  // Text processing
  toolExecutor.registerTool(new AwkTool());
  toolExecutor.registerTool(new SedTool());
  toolExecutor.registerTool(new WcTool());

  // Code tools
  toolExecutor.registerTool(new GetFileOutlineTool());
  toolExecutor.registerTool(new EditFileTool());
  toolExecutor.registerTool(new ApplyDiffTool());

  // Execution tools
  toolExecutor.registerTool(new RunCommandTool());
  toolExecutor.registerTool(new NodeEvalTool());

  // Testing and diagnostics
  toolExecutor.registerTool(new RunTestsTool());
  toolExecutor.registerTool(new GetDiagnosticsTool());

  // Code analysis
  toolExecutor.registerTool(new FindSymbolTool());

  console.log(
    chalk.green(`✓ Registered ${toolExecutor.getAvailableTools().length} tools`)
  );

  const parser = new NaturalLanguageParser(toolExecutor.getAvailableTools());
  const conversationManager = new ConversationManager(
    model,
    parser,
    toolExecutor,
    contextManager
  );

  // Load model
  const modelName = useOpenAI
    ? process.env.MODEL_NAME || 'openai/gpt-4o'
    : defaultModelConfig.modelName;

  console.log(chalk.yellow(`Loading model: ${modelName}...`));
  console.log(chalk.gray(`Provider: ${useOpenAI ? 'OpenAI-compatible' : 'Ollama'}`));

  const modelLoaded = await model.loadModel(modelName, {
    ...defaultModelConfig,
    modelName,
  });

  if (!modelLoaded) {
    console.error(chalk.red('\n❌ Failed to load model.'));
    if (!useOpenAI) {
      console.log(
        chalk.gray(`\nTry running: ollama pull ${defaultModelConfig.modelName}`)
      );
    }
    process.exit(1);
  }

  console.log(chalk.green('✓ Model loaded successfully!\n'));

  // Start session
  const sessionId = await conversationManager.startSession();
  console.log(chalk.gray(`Session ID: ${sessionId}\n`));

  // Setup readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.bold.blue('You: '),
  });

  console.log(chalk.gray('Type your message or "exit" to quit.'));
  console.log(chalk.gray('Special commands: /health, /errors, /clear-errors, /history, /backups, /rollback <file>'));
  console.log(chalk.gray('Monitoring: /stats [tool], /executions, /slowest, /failures, /active'));
  console.log(chalk.gray('Configuration: /config, /models, /tools, /check-system\n'));
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    // Exit command
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log(chalk.yellow('\nEnding session...'));
      await conversationManager.endSession(sessionId);
      console.log(chalk.green('Goodbye! 👋\n'));
      rl.close();
      process.exit(0);
    }

    // Health check command
    if (input.toLowerCase() === '/health') {
      console.log(chalk.yellow('\nRunning health check...\n'));
      const healthStatus = await healthMonitor.runHealthChecks();
      console.log(healthMonitor.formatHealthStatus(healthStatus));
      rl.prompt();
      return;
    }

    // Show errors command
    if (input.toLowerCase() === '/errors') {
      const recentErrors = errorHandler.getRecentErrors(10);
      if (recentErrors.length === 0) {
        console.log(chalk.green('\n✓ No recent errors\n'));
      } else {
        console.log(chalk.yellow(`\nRecent Errors (${recentErrors.length}):\n`));
        recentErrors.forEach((err, idx) => {
          console.log(`${idx + 1}. [${err.category}] ${err.message}`);
          console.log(`   Time: ${err.timestamp.toLocaleString()}`);
          console.log(`   Severity: ${err.severity}`);
          console.log();
        });
      }
      rl.prompt();
      return;
    }

    // Clear errors command
    if (input.toLowerCase() === '/clear-errors') {
      errorHandler.clearLogs();
      console.log(chalk.green('\n✓ Error logs cleared\n'));
      rl.prompt();
      return;
    }

    // Show change history
    if (input.toLowerCase() === '/history') {
      const history = globalBackupManager.getAllHistory(20);
      if (history.length === 0) {
        console.log(chalk.green('\n✓ No change history\n'));
      } else {
        console.log(chalk.yellow(`\nChange History (last ${history.length}):\n`));
        history.reverse().forEach((change, idx) => {
          const status = change.success ? chalk.green('✓') : chalk.red('✗');
          console.log(`${status} ${change.timestamp.toLocaleString()}`);
          console.log(`   File: ${change.filePath}`);
          console.log(`   Operation: ${change.operation}`);
          if (change.backupPath) {
            console.log(`   Backup: ${change.backupPath}`);
          }
          console.log();
        });
      }
      rl.prompt();
      return;
    }

    // List backups
    if (input.toLowerCase() === '/backups') {
      const backups = await globalBackupManager.listBackups();
      if (backups.length === 0) {
        console.log(chalk.green('\n✓ No backups available\n'));
      } else {
        console.log(chalk.yellow(`\nAvailable Backups (${backups.length}):\n`));
        backups.slice(-10).forEach((backup, idx) => {
          console.log(`${idx + 1}. ${backup}`);
        });
        console.log(chalk.gray('\nUse /rollback <filename> to restore\n'));
      }
      rl.prompt();
      return;
    }

    // Rollback file
    if (input.toLowerCase().startsWith('/rollback ')) {
      const filePath = input.substring(10).trim();
      if (!filePath) {
        console.log(chalk.red('\n❌ Usage: /rollback <file-path>\n'));
        rl.prompt();
        return;
      }

      console.log(chalk.yellow(`\nRolling back ${filePath}...\n`));
      const success = await globalBackupManager.rollbackFile(filePath);

      if (success) {
        console.log(chalk.green(`✓ Successfully rolled back ${filePath}\n`));
      } else {
        console.log(chalk.red(`❌ Failed to rollback ${filePath}\n`));
      }

      rl.prompt();
      return;
    }

    // Performance stats
    if (input.toLowerCase().startsWith('/stats')) {
      const executionMonitor = toolExecutor.getExecutionMonitor();
      const parts = input.split(' ');
      const toolName = parts[1]?.trim();

      if (toolName) {
        // Show stats for specific tool
        const stats = executionMonitor.getToolPerformance(toolName);
        if (stats) {
          console.log('\n' + executionMonitor.formatPerformanceStats(stats));
        } else {
          console.log(chalk.red(`\n❌ No execution data for tool: ${toolName}\n`));
        }
      } else {
        // Show stats for all tools
        const allStats = executionMonitor.getAllPerformanceStats();
        if (allStats.length === 0) {
          console.log(chalk.green('\n✓ No execution statistics available\n'));
        } else {
          console.log(chalk.yellow(`\n📊 Performance Statistics (${allStats.length} tools):\n`));
          allStats.slice(0, 10).forEach((stats) => {
            console.log(executionMonitor.formatPerformanceStats(stats));
          });
        }
      }
      rl.prompt();
      return;
    }

    // Recent executions
    if (input.toLowerCase() === '/executions') {
      const executionMonitor = toolExecutor.getExecutionMonitor();
      const executions = executionMonitor.getExecutionHistory(20);

      if (executions.length === 0) {
        console.log(chalk.green('\n✓ No execution history\n'));
      } else {
        console.log(chalk.yellow(`\nRecent Executions (${executions.length}):\n`));
        executions.reverse().forEach((exec, idx) => {
          const status = exec.success ? chalk.green('✓') : chalk.red('✗');
          const duration = exec.duration ? `${exec.duration.toFixed(2)}ms` : 'N/A';
          console.log(`${status} ${exec.toolName} - ${duration}`);
          console.log(`   Time: ${exec.startTime.toLocaleTimeString()}`);
          if (exec.error) {
            console.log(`   Error: ${exec.error}`);
          }
          console.log();
        });
      }
      rl.prompt();
      return;
    }

    // Slowest executions
    if (input.toLowerCase() === '/slowest') {
      const executionMonitor = toolExecutor.getExecutionMonitor();
      const slowest = executionMonitor.getSlowestExecutions(10);

      if (slowest.length === 0) {
        console.log(chalk.green('\n✓ No execution history\n'));
      } else {
        console.log(chalk.yellow(`\nSlowest Executions (${slowest.length}):\n`));
        slowest.forEach((exec, idx) => {
          console.log(`${idx + 1}. ${exec.toolName} - ${exec.duration?.toFixed(2)}ms`);
          console.log(`   Time: ${exec.startTime.toLocaleTimeString()}`);
          console.log();
        });
      }
      rl.prompt();
      return;
    }

    // Recent failures
    if (input.toLowerCase() === '/failures') {
      const executionMonitor = toolExecutor.getExecutionMonitor();
      const failures = executionMonitor.getRecentFailures(10);

      if (failures.length === 0) {
        console.log(chalk.green('\n✓ No recent failures\n'));
      } else {
        console.log(chalk.yellow(`\nRecent Failures (${failures.length}):\n`));
        failures.forEach((exec, idx) => {
          console.log(`${idx + 1}. ${exec.toolName}`);
          console.log(`   Time: ${exec.startTime.toLocaleTimeString()}`);
          if (exec.error) {
            console.log(`   Error: ${exec.error}`);
          }
          if (exec.timedOut) {
            console.log(chalk.red('   ⏱️  TIMED OUT'));
          }
          if (exec.cancelled) {
            console.log(chalk.yellow('   🚫 CANCELLED'));
          }
          console.log();
        });
      }
      rl.prompt();
      return;
    }

    // Active executions
    if (input.toLowerCase() === '/active') {
      const executionMonitor = toolExecutor.getExecutionMonitor();
      const active = executionMonitor.getActiveExecutions();

      if (active.length === 0) {
        console.log(chalk.green('\n✓ No active executions\n'));
      } else {
        console.log(chalk.yellow(`\nActive Executions (${active.length}):\n`));
        active.forEach((execId, idx) => {
          console.log(`${idx + 1}. ${execId}`);
        });
        console.log(chalk.gray('\nUse /cancel <execution_id> to cancel an execution\n'));
      }
      rl.prompt();
      return;
    }

    // Show configuration
    if (input.toLowerCase() === '/config') {
      try {
        await globalConfigManager.loadConfig();
        const config = globalConfigManager.getConfig();

        console.log(chalk.yellow('\n⚙️  Current Configuration:\n'));
        console.log(`Config file: ${globalConfigManager.getConfigPath()}`);
        console.log(`Version: ${config.version}`);
        console.log(`\nDefault Model: ${config.system.defaultModel}`);
        console.log(`Execution Timeout: ${config.system.execution.defaultTimeout}ms`);
        console.log(`Track Resources: ${config.system.execution.trackResources}`);
        console.log(`Backup Enabled: ${config.system.backup.enabled}`);
        console.log(`\nUse /models to see available models`);
        console.log(`Use /tools to see tool status\n`);
      } catch (error: any) {
        console.log(chalk.red(`\n❌ Failed to load configuration: ${error.message}\n`));
        console.log(chalk.gray('Run: npm run setup\n'));
      }
      rl.prompt();
      return;
    }

    // List models
    if (input.toLowerCase() === '/models') {
      try {
        await globalConfigManager.loadConfig();
        const config = globalConfigManager.getConfig();
        const models = Object.entries(config.system.models);

        console.log(chalk.yellow('\n🤖 Available Models:\n'));
        models.forEach(([name, model]) => {
          const isDefault = name === config.system.defaultModel;
          const marker = isDefault ? chalk.green('★') : ' ';
          console.log(`${marker} ${name}`);
          console.log(`   Provider: ${model.provider}`);
          console.log(`   Model: ${model.modelName}`);
          if (model.baseUrl) {
            console.log(`   Base URL: ${model.baseUrl}`);
          }
          console.log();
        });
        console.log(chalk.gray('★ = Default model\n'));
      } catch (error: any) {
        console.log(chalk.red(`\n❌ Failed to load configuration: ${error.message}\n`));
      }
      rl.prompt();
      return;
    }

    // List tools
    if (input.toLowerCase() === '/tools') {
      try {
        await globalConfigManager.loadConfig();
        const config = globalConfigManager.getConfig();
        const tools = Object.entries(config.system.tools);

        const enabled = tools.filter(([_, t]) => t.enabled);
        const disabled = tools.filter(([_, t]) => !t.enabled);

        console.log(chalk.yellow('\n🔧 Tool Status:\n'));

        if (enabled.length > 0) {
          console.log(chalk.green('Enabled Tools:'));
          enabled.forEach(([name, tool]) => {
            console.log(`  ✓ ${name}${tool.timeout ? ` (timeout: ${tool.timeout}ms)` : ''}`);
          });
          console.log();
        }

        if (disabled.length > 0) {
          console.log(chalk.red('Disabled Tools:'));
          disabled.forEach(([name, _]) => {
            console.log(`  ✗ ${name}`);
          });
          console.log();
        }

        console.log(chalk.gray(`Total: ${enabled.length} enabled, ${disabled.length} disabled\n`));
      } catch (error: any) {
        console.log(chalk.red(`\n❌ Failed to load configuration: ${error.message}\n`));
      }
      rl.prompt();
      return;
    }

    // Check system requirements
    if (input.toLowerCase() === '/check-system') {
      console.log(chalk.yellow('\nChecking system requirements...\n'));
      const requirements = await globalSystemChecker.checkSystemRequirements();
      console.log(globalSystemChecker.formatReport(requirements));
      rl.prompt();
      return;
    }

    if (!input) {
      rl.prompt();
      return;
    }

    try {
      console.log(chalk.gray('\nThinking...\n'));
      const response = await conversationManager.processMessage(sessionId, input);
      console.log(chalk.green('Assistant:'), response);
      console.log();
    } catch (error: any) {
      // Use error handler to format and log error
      await errorHandler.logError(error, { sessionId, input });
      console.error(chalk.red('\n' + errorHandler.formatUserError(error)));
      console.log();
    }

    rl.prompt();
  });

  rl.on('close', async () => {
    await conversationManager.endSession(sessionId);
    process.exit(0);
  });
}

// Run main function
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});

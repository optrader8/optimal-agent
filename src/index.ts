/**
 * Optimal Agent - Main Entry Point
 */

import { ConversationManager } from './agent/ConversationManager.js';
import { LocalModelFactory } from './models/LocalModelFactory.js';
import { NaturalLanguageParser } from './parsers/NaturalLanguageParser.js';
import { ToolExecutor } from './tools/ToolExecutor.js';
import { ContextManager } from './context/ContextManager.js';
import { ReadFileTool } from './tools/ReadFileTool.js';
import { WriteFileTool } from './tools/WriteFileTool.js';
import { ListDirectoryTool } from './tools/ListDirectoryTool.js';
import { FileTreeTool } from './tools/FileTreeTool.js';
import { GrepSearchTool } from './tools/GrepSearchTool.js';
import { RunCommandTool } from './tools/RunCommandTool.js';
import { defaultModelConfig, defaultSystemConfig } from './config.js';
import readline from 'readline';
import chalk from 'chalk';

async function main() {
  console.log(chalk.bold.cyan('🤖 Optimal Agent - Local Coding Assistant'));
  console.log(chalk.gray('=====================================\n'));

  // Initialize components
  console.log(chalk.yellow('Initializing components...'));

  const model = LocalModelFactory.create('ollama');
  const contextManager = new ContextManager();
  const toolExecutor = new ToolExecutor();

  // Register tools
  toolExecutor.registerTool(new ReadFileTool());
  toolExecutor.registerTool(new WriteFileTool());
  toolExecutor.registerTool(new ListDirectoryTool());
  toolExecutor.registerTool(new FileTreeTool());
  toolExecutor.registerTool(new GrepSearchTool());
  toolExecutor.registerTool(new RunCommandTool());

  const parser = new NaturalLanguageParser(toolExecutor.getAvailableTools());
  const conversationManager = new ConversationManager(
    model,
    parser,
    toolExecutor,
    contextManager
  );

  // Load model
  console.log(chalk.yellow(`Loading model: ${defaultModelConfig.modelName}...`));
  const modelLoaded = await model.loadModel(
    defaultModelConfig.modelName,
    defaultModelConfig
  );

  if (!modelLoaded) {
    console.error(
      chalk.red(
        `\n❌ Failed to load model. Please ensure Ollama is running and the model is installed.`
      )
    );
    console.log(chalk.gray(`\nTry running: ollama pull ${defaultModelConfig.modelName}`));
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

  console.log(chalk.gray('Type your message or "exit" to quit.\n'));
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log(chalk.yellow('\nEnding session...'));
      await conversationManager.endSession(sessionId);
      console.log(chalk.green('Goodbye! 👋\n'));
      rl.close();
      process.exit(0);
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
      console.error(chalk.red('Error:'), error.message);
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

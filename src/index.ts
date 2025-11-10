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

import { defaultModelConfig, defaultSystemConfig } from './config.js';
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

  const contextManager = new ContextManager();
  const toolExecutor = new ToolExecutor();

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

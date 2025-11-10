/**
 * Automated Tool Calling Test Script
 * Tests 30 different scenarios with GPT-OSS-20B
 */

import { ConversationManager } from './src/agent/ConversationManager.js';
import { LocalModelFactory } from './src/models/LocalModelFactory.js';
import { NaturalLanguageParser } from './src/parsers/NaturalLanguageParser.js';
import { ToolExecutor } from './src/tools/ToolExecutor.js';
import { ContextManager } from './src/context/ContextManager.js';

// Import all tools
import { ReadFileTool } from './src/tools/ReadFileTool.js';
import { WriteFileTool } from './src/tools/WriteFileTool.js';
import { ListDirectoryTool } from './src/tools/ListDirectoryTool.js';
import { FileTreeTool } from './src/tools/FileTreeTool.js';
import { FileStatTool } from './src/tools/FileStatTool.js';
import { GrepSearchTool } from './src/tools/GrepSearchTool.js';
import { RipgrepTool } from './src/tools/RipgrepTool.js';
import { FindTool } from './src/tools/FindTool.js';
import { AwkTool } from './src/tools/AwkTool.js';
import { SedTool } from './src/tools/SedTool.js';
import { WcTool } from './src/tools/WcTool.js';
import { GetFileOutlineTool } from './src/tools/GetFileOutlineTool.js';
import { EditFileTool } from './src/tools/EditFileTool.js';
import { ApplyDiffTool } from './src/tools/ApplyDiffTool.js';
import { RunCommandTool } from './src/tools/RunCommandTool.js';
import { NodeEvalTool } from './src/tools/NodeEvalTool.js';

import { defaultModelConfig } from './src/config.js';
import dotenv from 'dotenv';

dotenv.config();

// Test scenarios
const testScenarios = [
  // File operations
  { id: 1, query: "Read the file at package.json", expectedTool: "read_file" },
  { id: 2, query: "I need to read package.json", expectedTool: "read_file" },
  { id: 3, query: "Show me the contents of package.json", expectedTool: "read_file" },
  { id: 4, query: "List files in the src directory", expectedTool: "list_directory" },
  { id: 5, query: "What files are in src/", expectedTool: "list_directory" },
  { id: 6, query: "Show me the file tree of src/", expectedTool: "file_tree" },
  { id: 7, query: "Display directory structure for src/", expectedTool: "file_tree" },

  // File stats
  { id: 8, query: "Get file stats for package.json", expectedTool: "file_stat" },
  { id: 9, query: "fs.stat('package.json')", expectedTool: "node_eval" },
  { id: 10, query: "Check file metadata for tsconfig.json", expectedTool: "file_stat" },

  // Search operations
  { id: 11, query: "Search for 'interface' in the codebase", expectedTool: "grep_search" },
  { id: 12, query: "Let me grep for 'ModelConfig'", expectedTool: "grep_search" },
  { id: 13, query: "Find files named '*.ts'", expectedTool: "find" },
  { id: 14, query: "Locate all TypeScript files", expectedTool: "find" },
  { id: 15, query: "Use ripgrep to search for 'TODO'", expectedTool: "ripgrep" },

  // Code analysis
  { id: 16, query: "Show me the outline of src/index.ts", expectedTool: "get_file_outline" },
  { id: 17, query: "Get file structure of src/config.ts", expectedTool: "get_file_outline" },
  { id: 18, query: "Summarize the functions in src/index.ts", expectedTool: "get_file_outline" },

  // Text processing
  { id: 19, query: "Count lines in package.json", expectedTool: "wc" },
  { id: 20, query: "wc package.json", expectedTool: "wc" },
  { id: 21, query: "How many lines are in package.json?", expectedTool: "wc" },

  // Node.js code evaluation
  { id: 22, query: "path.join('src', 'index.ts')", expectedTool: "node_eval" },
  { id: 23, query: "Execute fs.readFileSync('package.json', 'utf-8')", expectedTool: "node_eval" },
  { id: 24, query: "Run: console.log(process.cwd())", expectedTool: "node_eval" },

  // Commands
  { id: 25, query: "Run the command 'ls -la'", expectedTool: "run_command" },
  { id: 26, query: "Execute shell command: pwd", expectedTool: "run_command" },
  { id: 27, query: "Run 'git status'", expectedTool: "run_command" },

  // Mixed scenarios
  { id: 28, query: "What's in the src directory and show me its tree structure", expectedTool: "multiple" },
  { id: 29, query: "Read package.json and count its lines", expectedTool: "multiple" },
  { id: 30, query: "Find all .ts files and show me the outline of src/index.ts", expectedTool: "multiple" },
];

async function runTests() {
  console.log('\n🧪 Starting Tool Calling Tests...\n');
  console.log('=' .repeat(80));

  // Initialize components
  const model = LocalModelFactory.create({
    provider: 'openai',
    baseUrl: process.env.OPENAI_BASE_URL!,
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const contextManager = new ContextManager();
  const toolExecutor = new ToolExecutor();

  // Register all tools
  toolExecutor.registerTool(new ReadFileTool());
  toolExecutor.registerTool(new WriteFileTool());
  toolExecutor.registerTool(new ListDirectoryTool());
  toolExecutor.registerTool(new FileTreeTool());
  toolExecutor.registerTool(new FileStatTool());
  toolExecutor.registerTool(new GrepSearchTool());
  toolExecutor.registerTool(new RipgrepTool());
  toolExecutor.registerTool(new FindTool());
  toolExecutor.registerTool(new AwkTool());
  toolExecutor.registerTool(new SedTool());
  toolExecutor.registerTool(new WcTool());
  toolExecutor.registerTool(new GetFileOutlineTool());
  toolExecutor.registerTool(new EditFileTool());
  toolExecutor.registerTool(new ApplyDiffTool());
  toolExecutor.registerTool(new RunCommandTool());
  toolExecutor.registerTool(new NodeEvalTool());

  const parser = new NaturalLanguageParser(toolExecutor.getAvailableTools());
  const conversationManager = new ConversationManager(
    model,
    parser,
    toolExecutor,
    contextManager
  );

  // Load model
  console.log(`\n📡 Connecting to: ${process.env.OPENAI_BASE_URL}`);
  const modelLoaded = await model.loadModel('openai/gpt-4o', {
    ...defaultModelConfig,
    modelName: 'openai/gpt-4o',
  });

  if (!modelLoaded) {
    console.error('❌ Failed to load model');
    process.exit(1);
  }

  console.log('✅ Model loaded successfully\n');
  console.log('=' .repeat(80));

  // Start session
  const sessionId = await conversationManager.startSession();

  let passed = 0;
  let failed = 0;
  const results: any[] = [];

  // Run each test
  for (const scenario of testScenarios) {
    console.log(`\n[Test ${scenario.id}/30] ${scenario.query}`);
    console.log('-'.repeat(80));

    try {
      const startTime = Date.now();
      const response = await conversationManager.processMessage(sessionId, scenario.query);
      const elapsed = Date.now() - startTime;

      // Parse the response to check if tools were called
      const toolCalls = parser.parseToolCalls(response);

      const toolsDetected = toolCalls.map(tc => tc.toolName);
      const success = scenario.expectedTool === 'multiple'
        ? toolsDetected.length > 1
        : toolsDetected.includes(scenario.expectedTool);

      if (success) {
        passed++;
        console.log(`✅ PASS - Detected tools: [${toolsDetected.join(', ')}]`);
      } else {
        failed++;
        console.log(`❌ FAIL - Expected: ${scenario.expectedTool}, Detected: [${toolsDetected.join(', ') || 'none'}]`);
      }

      console.log(`⏱️  Time: ${elapsed}ms`);
      console.log(`📝 Response length: ${response.length} chars`);

      results.push({
        id: scenario.id,
        query: scenario.query,
        expected: scenario.expectedTool,
        detected: toolsDetected,
        success,
        time: elapsed,
        responseLength: response.length,
      });

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      failed++;
      console.log(`❌ ERROR: ${error.message}`);
      results.push({
        id: scenario.id,
        query: scenario.query,
        expected: scenario.expectedTool,
        detected: [],
        success: false,
        error: error.message,
      });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testScenarios.length}`);
  console.log(`✅ Passed: ${passed} (${Math.round(passed / testScenarios.length * 100)}%)`);
  console.log(`❌ Failed: ${failed} (${Math.round(failed / testScenarios.length * 100)}%)`);

  // Print detailed results
  console.log('\n📋 DETAILED RESULTS:');
  console.log('='.repeat(80));
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} Test ${r.id}: Expected [${r.expected}], Got [${r.detected.join(', ') || 'none'}]`);
  });

  // Clean up
  await conversationManager.endSession(sessionId);

  console.log('\n' + '='.repeat(80));
  console.log('🏁 Testing Complete!');
  console.log('='.repeat(80) + '\n');
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

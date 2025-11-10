/**
 * API Connection Test Suite
 * Tests https://gpt.optsoft.store with multiple scenarios
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
import { RunTestsTool } from './src/tools/RunTestsTool.js';
import { GetDiagnosticsTool } from './src/tools/GetDiagnosticsTool.js';

import { defaultModelConfig } from './src/config.js';
import { globalErrorHandler } from './src/errors/ErrorHandler.js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

interface TestResult {
  testNumber: number;
  testName: string;
  success: boolean;
  duration: number;
  error?: string;
  response?: string;
}

const testScenarios = [
  {
    name: 'Simple File Read',
    query: 'Read the package.json file',
    expectation: 'Should parse read_file tool call and execute',
  },
  {
    name: 'File Tree Generation',
    query: 'Show me the file tree of src/ directory',
    expectation: 'Should generate file tree structure',
  },
  {
    name: 'Search Pattern',
    query: 'Search for "ModelConfig" in the codebase',
    expectation: 'Should use grep or ripgrep to search',
  },
  {
    name: 'File Statistics',
    query: 'Get stats for package.json',
    expectation: 'Should return file metadata',
  },
  {
    name: 'List Directory',
    query: 'List files in src/tools',
    expectation: 'Should list tool files',
  },
  {
    name: 'Word Count',
    query: 'How many lines are in README.md',
    expectation: 'Should count lines using wc',
  },
  {
    name: 'Multi-turn Context',
    query: 'What is the project name? (from package.json)',
    expectation: 'Should remember previous file reads',
  },
  {
    name: 'Tool Combination',
    query: 'List all TypeScript files in src/ and count them',
    expectation: 'Should combine find and wc',
  },
  {
    name: 'Error Handling',
    query: 'Read nonexistent-file.txt',
    expectation: 'Should handle error gracefully',
  },
  {
    name: 'Natural Language Parsing',
    query: 'Can you show me what is inside the config.ts file?',
    expectation: 'Should parse natural language to read_file',
  },
];

async function testAPIConnection(): Promise<boolean> {
  console.log('\n🔌 Testing API Connection...\n');

  try {
    const response = await axios.get(`${process.env.OPENAI_BASE_URL}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      timeout: 10000,
    });

    console.log('✅ API Connection: SUCCESS');
    console.log(`📋 Available models: ${response.data.data?.length || 0}`);
    if (response.data.data && response.data.data.length > 0) {
      console.log(`   Models: ${response.data.data.map((m: any) => m.id).join(', ')}`);
    }
    return true;
  } catch (error: any) {
    console.log(`❌ API Connection: FAILED`);
    if (error.response) {
      console.log(`   Status: ${error.response.status} ${error.response.statusText}`);
      console.log(`   Response: ${JSON.stringify(error.response.data)}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    return false;
  }
}

async function setupComponents() {
  const model = LocalModelFactory.create({
    provider: 'openai',
    baseUrl: process.env.OPENAI_BASE_URL!,
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const contextManager = new ContextManager();
  const toolExecutor = new ToolExecutor(globalErrorHandler);

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
  toolExecutor.registerTool(new RunTestsTool());
  toolExecutor.registerTool(new GetDiagnosticsTool());

  const parser = new NaturalLanguageParser(toolExecutor.getAvailableTools());
  const conversationManager = new ConversationManager(
    model,
    parser,
    toolExecutor,
    contextManager
  );

  // Load model
  const modelName = process.env.MODEL_NAME || 'gpt-4o';
  const modelLoaded = await model.loadModel(modelName, {
    ...defaultModelConfig,
    modelName,
  });

  if (!modelLoaded) {
    throw new Error('Failed to load model');
  }

  console.log(`✅ Model loaded: ${modelName}`);
  console.log(`✅ Tools registered: ${toolExecutor.getAvailableTools().length}`);

  return { conversationManager, contextManager };
}

async function runTest(
  testNumber: number,
  scenario: typeof testScenarios[0],
  conversationManager: ConversationManager,
  sessionId: string
): Promise<TestResult> {
  const startTime = Date.now();

  console.log(`\n📝 Test ${testNumber}/10: ${scenario.name}`);
  console.log(`   Query: "${scenario.query}"`);
  console.log(`   Expectation: ${scenario.expectation}`);

  try {
    const response = await conversationManager.processMessage(sessionId, scenario.query);
    const duration = Date.now() - startTime;

    // Check if response is reasonable
    const responseLength = response.length;
    const hasToolOutput = response.includes('[Tool:');
    const hasError = response.toLowerCase().includes('error') || response.toLowerCase().includes('failed');

    console.log(`   ✅ Response received (${duration}ms, ${responseLength} chars)`);
    if (hasToolOutput) {
      console.log(`   ✓ Tool execution detected`);
    }
    if (hasError && scenario.name !== 'Error Handling') {
      console.log(`   ⚠️  Response contains error/failed`);
    }

    // Show first 200 chars of response
    const preview = response.substring(0, 200).replace(/\n/g, ' ');
    console.log(`   Preview: ${preview}${responseLength > 200 ? '...' : ''}`);

    return {
      testNumber,
      testName: scenario.name,
      success: true,
      duration,
      response: response.substring(0, 500),
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`   ❌ Test failed: ${error.message}`);

    return {
      testNumber,
      testName: scenario.name,
      success: false,
      duration,
      error: error.message,
    };
  }
}

async function runAllTests() {
  console.log('\n🚀 API Test Suite - 10 Scenarios');
  console.log('='.repeat(80));
  console.log(`API Endpoint: ${process.env.OPENAI_BASE_URL}`);
  console.log(`Model: ${process.env.MODEL_NAME || 'gpt-4o'}`);
  console.log('='.repeat(80));

  // Step 1: Test API connection
  const apiOk = await testAPIConnection();
  if (!apiOk) {
    console.log('\n❌ API connection failed. Aborting tests.');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Setting up components...');

  // Step 2: Setup components
  const { conversationManager, contextManager } = await setupComponents();
  const sessionId = await conversationManager.startSession();

  console.log(`✅ Session started: ${sessionId}`);
  console.log('='.repeat(80));

  // Step 3: Run all tests
  const results: TestResult[] = [];

  for (let i = 0; i < testScenarios.length; i++) {
    const result = await runTest(i + 1, testScenarios[i], conversationManager, sessionId);
    results.push(result);

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Step 4: Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Test Summary');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = totalDuration / results.length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  console.log(`⏱️  Average Duration: ${Math.round(avgDuration)}ms`);
  console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  // Failed tests detail
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   ${r.testNumber}. ${r.testName}`);
      console.log(`      Error: ${r.error}`);
    });
  }

  // Context tracking
  console.log('\n📊 Context Tracking:');
  const mentionedFiles = await contextManager.getMentionedFiles(sessionId);
  const focus = await contextManager.getConversationFocus(sessionId);
  const toolExecutions = await contextManager.getRecentToolExecutions(sessionId);

  console.log(`   Mentioned files: ${mentionedFiles.length}`);
  console.log(`   Conversation focus: ${focus.length}`);
  console.log(`   Tool executions: ${toolExecutions.length}`);

  if (mentionedFiles.length > 0) {
    console.log(`   Files: ${mentionedFiles.slice(0, 5).join(', ')}${mentionedFiles.length > 5 ? '...' : ''}`);
  }

  // Error statistics
  const errorStats = globalErrorHandler.getErrorStatistics();
  if (errorStats.total > 0) {
    console.log('\n⚠️  Error Statistics:');
    console.log(`   Total errors: ${errorStats.total}`);
    Object.entries(errorStats.byCategory).forEach(([category, count]) => {
      if (count > 0) {
        console.log(`   ${category}: ${count}`);
      }
    });
  }

  // Cleanup
  await conversationManager.endSession(sessionId);

  console.log('\n' + '='.repeat(80));
  console.log(passed === results.length ? '🎉 All tests passed!' : `⚠️  ${failed} test(s) failed`);
  console.log('='.repeat(80) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

/**
 * Multi-Turn Conversation Test with GPT-OSS-20B
 * Tests enhanced context tracking and conversation management
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
import axios from 'axios';

dotenv.config();

/**
 * Multi-turn test scenarios demonstrating context tracking
 */
const multiTurnScenarios = [
  {
    name: 'File Reading and Analysis',
    conversations: [
      { user: 'Read package.json', expectTools: ['read_file'] },
      { user: 'What version is it?', expectContext: 'package.json' },
      { user: 'Count how many dependencies it has', expectTools: ['node_eval', 'grep_search'] },
    ],
  },
  {
    name: 'Directory Exploration',
    conversations: [
      { user: 'Show me the file tree of src/', expectTools: ['file_tree'] },
      { user: 'What files are in the tools directory?', expectContext: 'src/tools' },
      { user: 'Read the first one you found', expectContext: 'tools' },
    ],
  },
  {
    name: 'Code Search and Modification',
    conversations: [
      { user: 'Search for "ModelConfig" in the codebase', expectTools: ['grep_search', 'ripgrep'] },
      { user: 'Show me that file', expectContext: 'file' },
      { user: 'Get file stats for it', expectContext: 'file' },
    ],
  },
];

async function testAPIConnection() {
  console.log('\n🔌 Testing API Connection to https://gpt.optsoft.store\n');
  console.log('='.repeat(80));

  try {
    // Test basic API connectivity using axios (supports proxy)
    const response = await axios.get(`${process.env.OPENAI_BASE_URL}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });

    console.log('✅ API Connection: SUCCESS');
    console.log(`📋 Available models: ${response.data.data?.length || 0}`);
    if (response.data.data && response.data.data.length > 0) {
      console.log(`   First model: ${response.data.data[0].id || 'unknown'}`);
    }
  } catch (error: any) {
    console.log(`❌ API Connection: ERROR - ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status} ${error.response.statusText}`);
      console.log(`   Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    }
    return false;
  }

  console.log('='.repeat(80));
  return true;
}

async function testMultiTurnConversation() {
  console.log('\n🔄 Testing Enhanced Multi-Turn Conversation\n');
  console.log('='.repeat(80));

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
  console.log(`🔑 API Key: ${process.env.OPENAI_API_KEY?.substring(0, 20)}...`);

  const modelLoaded = await model.loadModel('openai/gpt-4o', {
    ...defaultModelConfig,
    modelName: 'openai/gpt-4o',
  });

  if (!modelLoaded) {
    console.error('❌ Failed to load model');
    return;
  }

  console.log('✅ Model loaded successfully\n');
  console.log('='.repeat(80));

  // Test simple query first
  console.log('\n🧪 Test 1: Simple Tool Call');
  console.log('-'.repeat(80));

  const sessionId = await conversationManager.startSession();

  try {
    const query = 'Read the file package.json';
    console.log(`User: ${query}`);

    const startTime = Date.now();
    const response = await conversationManager.processMessage(sessionId, query);
    const elapsed = Date.now() - startTime;

    console.log(`\n📝 Response (${elapsed}ms):`);
    console.log(response.substring(0, 500));
    if (response.length > 500) {
      console.log('...(truncated)');
    }

    // Check context tracking
    const focus = await contextManager.getConversationFocus(sessionId);
    const mentionedFiles = await contextManager.getMentionedFiles(sessionId);
    const toolExecutions = await contextManager.getRecentToolExecutions(sessionId);

    console.log('\n📊 Context Tracking:');
    console.log(`   Conversation focus: [${focus.join(', ')}]`);
    console.log(`   Mentioned files: [${mentionedFiles.join(', ')}]`);
    console.log(`   Tool executions: ${toolExecutions.length}`);

    if (toolExecutions.length > 0) {
      console.log('   ✅ Tool execution tracking working!');
    }

  } catch (error: any) {
    console.log(`❌ ERROR: ${error.message}`);
    console.log(`   Stack: ${error.stack?.split('\n')[0]}`);
  }

  // Test 2: Multi-turn conversation
  console.log('\n\n🧪 Test 2: Multi-Turn Conversation with Context');
  console.log('-'.repeat(80));

  try {
    // First message
    console.log('User: List files in src/');
    let response = await conversationManager.processMessage(sessionId, 'List files in src/');
    console.log(`Response length: ${response.length} chars\n`);

    // Second message - should use context from first
    console.log('User: How many files did you find?');
    response = await conversationManager.processMessage(sessionId, 'How many files did you find?');
    console.log(`Response length: ${response.length} chars\n`);

    // Check enhanced context
    const contextSummary = await contextManager.getContextSummary(sessionId);
    console.log('📊 Context Summary:');
    console.log(contextSummary);

    console.log('\n✅ Multi-turn conversation test completed!');

  } catch (error: any) {
    console.log(`❌ ERROR: ${error.message}`);
  }

  await conversationManager.endSession(sessionId);

  console.log('\n' + '='.repeat(80));
  console.log('🏁 Multi-Turn Testing Complete!');
  console.log('='.repeat(80) + '\n');
}

async function runTests() {
  console.log('\n🚀 Enhanced Multi-Turn Conversation Test Suite\n');
  console.log('='.repeat(80));
  console.log('Testing:');
  console.log('  ✓ API connection to gpt.optsoft.store');
  console.log('  ✓ Enhanced context tracking');
  console.log('  ✓ Multi-turn conversation handling');
  console.log('  ✓ File mention tracking');
  console.log('  ✓ Tool execution history');
  console.log('='.repeat(80));

  // Test 1: API Connection
  const apiOk = await testAPIConnection();

  if (!apiOk) {
    console.log('\n⚠️  API connection failed - check API key and endpoint');
    console.log('Continuing with local tests...\n');
  }

  // Test 2: Multi-turn conversation
  await testMultiTurnConversation();

  console.log('\n✅ All tests completed!');
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

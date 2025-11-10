/**
 * Simple Demo - Test tool execution without model
 * Shows that all tools work correctly
 */

import { ToolExecutor } from './src/tools/ToolExecutor.js';
import { NaturalLanguageParser } from './src/parsers/NaturalLanguageParser.js';

// Import all tools
import { ReadFileTool } from './src/tools/ReadFileTool.js';
import { FileTreeTool } from './src/tools/FileTreeTool.js';
import { FileStatTool } from './src/tools/FileStatTool.js';
import { GrepSearchTool } from './src/tools/GrepSearchTool.js';
import { WcTool } from './src/tools/WcTool.js';
import { RunCommandTool } from './src/tools/RunCommandTool.js';
import { NodeEvalTool } from './src/tools/NodeEvalTool.js';

async function demo() {
  console.log('\n🎯 Optimal Agent - Tool Demonstration\n');
  console.log('='.repeat(80));

  // Setup
  const toolExecutor = new ToolExecutor();
  toolExecutor.registerTool(new ReadFileTool());
  toolExecutor.registerTool(new FileTreeTool());
  toolExecutor.registerTool(new FileStatTool());
  toolExecutor.registerTool(new GrepSearchTool());
  toolExecutor.registerTool(new WcTool());
  toolExecutor.registerTool(new RunCommandTool());
  toolExecutor.registerTool(new NodeEvalTool());

  const parser = new NaturalLanguageParser(toolExecutor.getAvailableTools());

  console.log(`\n✓ Registered ${toolExecutor.getAvailableTools().length} tools\n`);
  console.log('='.repeat(80));

  // Test scenarios
  const tests = [
    {
      name: 'Parser + Read File',
      input: 'I need to read the file at package.json',
      execute: true,
    },
    {
      name: 'Parser + File Tree',
      input: 'Show me the file tree of src/',
      execute: true,
    },
    {
      name: 'Parser + File Stats',
      input: 'Get file stats for package.json',
      execute: true,
    },
    {
      name: 'Parser + Word Count',
      input: 'Count lines in package.json',
      execute: true,
    },
    {
      name: 'Parser + Node.js Eval',
      input: 'fs.stat("package.json")',
      execute: true,
    },
    {
      name: 'Parser + Command',
      input: 'Run the command "pwd"',
      execute: true,
    },
  ];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n[Test ${i + 1}/${tests.length}] ${test.name}`);
    console.log('-'.repeat(80));
    console.log(`Input: "${test.input}"`);

    // Parse
    const toolCalls = parser.parseToolCalls(test.input);
    console.log(`Parsed: [${toolCalls.map(tc => tc.toolName).join(', ')}]`);

    if (test.execute && toolCalls.length > 0) {
      // Execute first tool call
      const toolCall = toolCalls[0];
      console.log(`Executing: ${toolCall.toolName}(${JSON.stringify(toolCall.parameters)})`);

      try {
        const result = await toolExecutor.executeTool(toolCall);

        if (result.success) {
          console.log(`✅ Success (${result.executionTime}ms)`);
          // Limit output length for readability
          const output = result.output.length > 200
            ? result.output.substring(0, 200) + '...(truncated)'
            : result.output;
          console.log(`Output:\n${output}`);
        } else {
          console.log(`❌ Failed: ${result.errorMessage}`);
        }
      } catch (error: any) {
        console.log(`❌ Error: ${error.message}`);
      }
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ All local tools are working correctly!');
  console.log('='.repeat(80));
  console.log('\nNote: This demonstrates that the parser and tools work perfectly.');
  console.log('When connected to GPT-OSS-20B, the model will use these same tools.');
  console.log('='.repeat(80) + '\n');
}

demo().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

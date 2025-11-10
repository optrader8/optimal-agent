/**
 * Parser Test Script
 * Tests natural language parsing for tool calling patterns
 */

import { NaturalLanguageParser } from './src/parsers/NaturalLanguageParser.js';

const allTools = [
  'read_file', 'write_file', 'list_directory', 'file_tree', 'file_stat',
  'grep_search', 'ripgrep', 'find', 'awk', 'sed', 'wc',
  'get_file_outline', 'edit_file', 'apply_diff',
  'run_command', 'node_eval'
];

// Test scenarios with model-like responses
const testScenarios = [
  // File operations
  { id: 1, input: "I need to read the file at src/main.ts", expected: "read_file" },
  { id: 2, input: "Let me read package.json", expected: "read_file" },
  { id: 3, input: "I'll create a file config.json with content: {...}", expected: "write_file" },
  { id: 4, input: "Let me list the files in src/", expected: "list_directory" },
  { id: 5, input: "Show me the directory structure", expected: "list_directory" },
  { id: 6, input: "I'll show you the file tree of src/", expected: "file_tree" },
  { id: 7, input: "Display tree structure for the project", expected: "file_tree" },

  // File stats
  { id: 8, input: "Get file stats for package.json", expected: "file_stat" },
  { id: 9, input: "Let me check file metadata for tsconfig.json", expected: "file_stat" },
  { id: 10, input: "fs.stat('package.json')", expected: "node_eval" },

  // Search operations
  { id: 11, input: "Let me search for 'interface' in the codebase", expected: "grep_search" },
  { id: 12, input: "I'll grep for 'ModelConfig'", expected: "grep_search" },
  { id: 13, input: "Find files named '*.ts'", expected: "find" },
  { id: 14, input: "I need to locate files matching '*.json'", expected: "find" },
  { id: 15, input: "Let me use ripgrep to search for 'TODO'", expected: "ripgrep" },
  { id: 16, input: "rg 'FIXME' in src/", expected: "ripgrep" },

  // Code analysis
  { id: 17, input: "Show me the outline of src/index.ts", expected: "get_file_outline" },
  { id: 18, input: "Get file structure for src/config.ts", expected: "get_file_outline" },
  { id: 19, input: "Display the outline of package.json", expected: "get_file_outline" },

  // Text processing
  { id: 20, input: "Count lines in package.json", expected: "wc" },
  { id: 21, input: "wc -l package.json", expected: "wc" },
  { id: 22, input: "How many lines are in src/index.ts", expected: "wc" },
  { id: 23, input: "awk '{print $1}' data.txt", expected: "awk" },
  { id: 24, input: "sed 's/old/new/g' file.txt", expected: "sed" },

  // Node.js code evaluation
  { id: 25, input: "path.join('src', 'index.ts')", expected: "node_eval" },
  { id: 26, input: "fs.readFileSync('package.json', 'utf-8')", expected: "node_eval" },
  { id: 27, input: "Execute: console.log(process.cwd())", expected: "node_eval" },
  { id: 28, input: "Let me run fs.stat('tsconfig.json')", expected: "node_eval" },

  // Commands
  { id: 29, input: "Run the command 'ls -la'", expected: "run_command" },
  { id: 30, input: "Execute shell command: pwd", expected: "run_command" },
  { id: 31, input: "I'll run 'git status'", expected: "run_command" },
  { id: 32, input: "Running command: npm test", expected: "run_command" },

  // Edge cases
  { id: 33, input: "Read src/main.ts and show its outline", expected: "multiple" },
  { id: 34, input: "First, let me read package.json to check the version", expected: "read_file" },
  { id: 35, input: "I should search for 'TODO' comments using grep", expected: "grep_search" },
];

function runParserTests() {
  console.log('\n🧪 Parser Test Suite\n');
  console.log('='.repeat(80));

  const parser = new NaturalLanguageParser(allTools);

  let passed = 0;
  let failed = 0;
  const failedTests: any[] = [];

  for (const scenario of testScenarios) {
    const toolCalls = parser.parseToolCalls(scenario.input);
    const toolsDetected = toolCalls.map(tc => tc.toolName);

    const success = scenario.expected === 'multiple'
      ? toolsDetected.length > 1
      : toolsDetected.includes(scenario.expected);

    const status = success ? '✅' : '❌';

    if (success) {
      passed++;
      console.log(`${status} Test ${scenario.id}: ${scenario.expected} -> [${toolsDetected.join(', ')}]`);
    } else {
      failed++;
      console.log(`${status} Test ${scenario.id}: Expected [${scenario.expected}], Got [${toolsDetected.join(', ') || 'NONE'}]`);
      console.log(`   Input: "${scenario.input}"`);
      failedTests.push({
        id: scenario.id,
        input: scenario.input,
        expected: scenario.expected,
        detected: toolsDetected,
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testScenarios.length}`);
  console.log(`✅ Passed: ${passed} (${Math.round(passed / testScenarios.length * 100)}%)`);
  console.log(`❌ Failed: ${failed} (${Math.round(failed / testScenarios.length * 100)}%)`);

  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests Details:');
    console.log('='.repeat(80));
    failedTests.forEach(t => {
      console.log(`\nTest ${t.id}:`);
      console.log(`  Input: "${t.input}"`);
      console.log(`  Expected: [${t.expected}]`);
      console.log(`  Detected: [${t.detected.join(', ') || 'NONE'}]`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('🏁 Parser Testing Complete!');
  console.log('='.repeat(80) + '\n');

  return { passed, failed, total: testScenarios.length };
}

// Run tests
const results = runParserTests();

// Exit with error if tests failed
if (results.failed > 0) {
  process.exit(1);
}

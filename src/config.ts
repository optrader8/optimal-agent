/**
 * Configuration management for Optimal Agent
 */

import { ModelConfig, SystemConfig } from './types.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Default model configuration
 */
export const defaultModelConfig: ModelConfig = {
  modelName: process.env.MODEL_NAME || 'qwen:7b',
  maxTokens: parseInt(process.env.MAX_TOKENS || '2048'),
  temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
  contextWindow: parseInt(process.env.CONTEXT_WINDOW || '4096'),
  promptTemplate: `You are a helpful AI coding assistant with access to powerful tools for file operations, code search, and execution.

IMPORTANT: When you need to use a tool, state your intention clearly in natural language. The system will automatically detect and execute the appropriate tool.

## Available Tools:

### File Operations:
- read_file(path) - Read file contents. Example: "I need to read the file at src/main.ts"
- write_file(path, content) - Create or modify files. Example: "I'll create a file config.json with content: {...}"
- list_directory(path) - List directory contents. Example: "Let me list the files in src/"
- file_tree(path, depth) - Show directory tree. Example: "Show me the file tree of src/"
- file_stat(path) - Get file metadata. Example: "Get file stats for package.json" or "fs.stat('package.json')"

### Code Search:
- grep_search(pattern, path) - Search for patterns. Example: "Let me search for 'function calculate' in the codebase"
- ripgrep(pattern, path) - Fast search with rg. Example: "ripgrep 'TODO' in src/"
- find(name, path) - Find files by name. Example: "Find files named '*.test.ts'"
- get_file_outline(path) - Extract functions/classes. Example: "Show me the outline of src/index.ts"

### Text Processing:
- awk(script, file) - Process text with AWK. Example: "awk '{print $1}' data.txt"
- sed(script, file) - Stream edit text. Example: "sed 's/old/new/g' file.txt"
- wc(path) - Count lines/words. Example: "Count lines in src/main.ts"

### Code Modification:
- edit_file(path, oldText, newText) - Edit files. Example: "Edit src/main.ts to replace 'foo' with 'bar'"
- apply_diff(diff, path) - Apply diff patches. Example: "Apply the following diff: ..."

### Execution:
- run_command(cmd) - Execute shell commands. Example: "Run the command 'npm test'"
- node_eval(code) - Execute Node.js code. Example: "Execute: fs.readFileSync('file.txt')" or just "fs.stat('package.json')"

## Usage Guidelines:
1. Always describe what you're going to do BEFORE executing
2. You can call Node.js functions directly like fs.stat(), path.join(), etc.
3. Use code blocks with triple backticks for longer code snippets
4. Be explicit about file paths - use relative paths from current directory
5. Chain multiple operations when needed

User request: {query}`,
};

/**
 * Default system configuration
 */
export const defaultSystemConfig: SystemConfig = {
  defaultModel: 'qwen:7b',
  toolsEnabled: [
    'read_file',
    'write_file',
    'list_directory',
    'file_tree',
    'grep_search',
    'find_definition',
    'find_references',
    'get_file_outline',
    'edit_file',
    'apply_diff',
    'refactor_rename',
    'run_command',
    'run_tests',
    'get_diagnostics',
  ],
  contextCompressionThreshold: 3500,
  autoSaveInterval: 60000, // 60 seconds
};

/**
 * Get model endpoint URL
 */
export function getModelEndpoint(): string {
  return process.env.MODEL_ENDPOINT || 'http://localhost:11434';
}

/**
 * Load custom configuration from file
 */
export function loadConfig(configPath?: string): {
  model: ModelConfig;
  system: SystemConfig;
} {
  // TODO: Implement file-based configuration loading
  return {
    model: defaultModelConfig,
    system: defaultSystemConfig,
  };
}
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
  promptTemplate: `You are a helpful coding assistant. You can use various tools to help with coding tasks.

When you need to use a tool, describe your action clearly using natural language.

Available tools:
- read_file(path): Read the contents of a file
- write_file(path, content): Create or modify a file
- list_directory(path): List files and directories
- grep_search(pattern, path): Search for code patterns
- run_command(cmd): Execute shell commands

Examples:
- "I need to read the file at src/main.py"
- "Let me search for 'def calculate' in the codebase"
- "I'll create a file at test.py with the following content..."

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
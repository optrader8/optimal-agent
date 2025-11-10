/**
 * Core type definitions for Optimal Agent
 */

/**
 * Message in conversation
 */
export interface Message {
  id: string;
  timestamp: Date;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, any>;
}

/**
 * Tool call parsed from natural language
 */
export interface ToolCall {
  toolName: string;
  parameters: Record<string, any>;
  confidence: number;
  sourceText: string;
}

/**
 * Conversation context
 */
export interface Context {
  messages: Message[];
  currentFiles: string[];
  workingDirectory: string;
  sessionState: Record<string, any>;
  tokenCount: number;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  output: string;
  errorMessage?: string;
  executionTime: number;
}

/**
 * Model configuration
 */
export interface ModelConfig {
  modelName: string;
  maxTokens: number;
  temperature: number;
  contextWindow: number;
  promptTemplate: string;
}

/**
 * System configuration
 */
export interface SystemConfig {
  defaultModel: string;
  toolsEnabled: string[];
  contextCompressionThreshold: number;
  autoSaveInterval: number;
}

/**
 * Session identifier
 */
export type SessionId = string;

/**
 * Model information
 */
export interface ModelInfo {
  name: string;
  version: string;
  contextWindow: number;
  capabilities: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Recovery action for errors
 */
export interface RecoveryAction {
  type: 'retry' | 'switch_model' | 'ask_user' | 'partial_result';
  message: string;
  alternatives?: string[];
}

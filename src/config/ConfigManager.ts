/**
 * Configuration Manager
 * Manages system configuration with validation and persistence
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface ModelConfig {
  provider: 'ollama' | 'openai';
  modelName: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeout?: number;
}

export interface ToolConfig {
  enabled: boolean;
  timeout?: number;
  options?: Record<string, any>;
}

export interface SystemConfig {
  defaultModel: string; // Reference to model in models array
  models: Record<string, ModelConfig>;
  tools: Record<string, ToolConfig>;
  execution: {
    defaultTimeout: number;
    trackResources: boolean;
    maxHistorySize: number;
  };
  context: {
    maxTokens: number;
    compressionRatio: number;
    workingSetSize: number;
    fileCacheSize: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    errorLogPath: string;
    maxErrorLogs: number;
  };
  backup: {
    enabled: boolean;
    retentionDays: number;
  };
}

export interface ConfigFile {
  version: string;
  system: SystemConfig;
}

export class ConfigManager {
  private configPath: string;
  private config: ConfigFile | null = null;
  private readonly currentVersion = '1.0.0';
  private readonly defaultConfigPath = path.join(os.homedir(), '.optimal-agent', 'config.json');

  constructor(configPath?: string) {
    this.configPath = configPath || this.defaultConfigPath;
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<ConfigFile> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      let config = JSON.parse(content) as ConfigFile;

      // Validate configuration
      this.validateConfig(config);

      // Check version and migrate if needed
      if (config.version !== this.currentVersion) {
        config = await this.migrateConfig(config);
      }

      this.config = config;
      return config;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Config doesn't exist, create default
        console.log('Configuration file not found. Creating default configuration...');
        this.config = this.createDefaultConfig();
        await this.saveConfig();
        return this.config;
      }
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration to save');
    }

    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });

    // Write config with pretty formatting
    await fs.writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2),
      'utf-8'
    );
  }

  /**
   * Get current configuration
   */
  getConfig(): ConfigFile {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ConfigFile>): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    this.config = {
      ...this.config,
      ...updates,
      system: {
        ...this.config.system,
        ...(updates.system || {}),
      },
    };
  }

  /**
   * Get model configuration
   */
  getModelConfig(modelName?: string): ModelConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const name = modelName || this.config.system.defaultModel;
    const model = this.config.system.models[name];

    if (!model) {
      throw new Error(`Model not found: ${name}`);
    }

    return model;
  }

  /**
   * Add or update model configuration
   */
  setModelConfig(name: string, config: ModelConfig): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    this.config.system.models[name] = config;
  }

  /**
   * Set default model
   */
  setDefaultModel(name: string): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    if (!this.config.system.models[name]) {
      throw new Error(`Model not found: ${name}`);
    }

    this.config.system.defaultModel = name;
  }

  /**
   * Get list of available models
   */
  getAvailableModels(): string[] {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    return Object.keys(this.config.system.models);
  }

  /**
   * Get tool configuration
   */
  getToolConfig(toolName: string): ToolConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    return this.config.system.tools[toolName] || { enabled: true };
  }

  /**
   * Enable or disable a tool
   */
  setToolEnabled(toolName: string, enabled: boolean): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    if (!this.config.system.tools[toolName]) {
      this.config.system.tools[toolName] = { enabled };
    } else {
      this.config.system.tools[toolName].enabled = enabled;
    }
  }

  /**
   * Get list of enabled tools
   */
  getEnabledTools(): string[] {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    return Object.entries(this.config.system.tools)
      .filter(([_, config]) => config.enabled)
      .map(([name, _]) => name);
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(): ConfigFile {
    return {
      version: this.currentVersion,
      system: {
        defaultModel: 'qwen2.5-coder',
        models: {
          'qwen2.5-coder': {
            provider: 'ollama',
            modelName: 'qwen2.5-coder:7b',
            baseUrl: 'http://localhost:11434',
            temperature: 0.7,
            maxTokens: 4096,
          },
          'deepseek-coder': {
            provider: 'ollama',
            modelName: 'deepseek-coder:6.7b',
            baseUrl: 'http://localhost:11434',
            temperature: 0.7,
            maxTokens: 4096,
          },
          'openai-compatible': {
            provider: 'openai',
            modelName: 'gpt-4',
            baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
            apiKey: process.env.OPENAI_API_KEY || '',
            temperature: 0.7,
            maxTokens: 4096,
          },
        },
        tools: {
          // All tools enabled by default
          read_file: { enabled: true },
          write_file: { enabled: true, timeout: 30000 },
          list_directory: { enabled: true },
          file_tree: { enabled: true },
          file_stat: { enabled: true },
          grep_search: { enabled: true },
          ripgrep: { enabled: true },
          find: { enabled: true },
          awk: { enabled: true },
          sed: { enabled: true },
          wc: { enabled: true },
          get_file_outline: { enabled: true },
          edit_file: { enabled: true, timeout: 30000 },
          apply_diff: { enabled: true },
          run_command: { enabled: true, timeout: 60000 },
          node_eval: { enabled: true },
          run_tests: { enabled: true, timeout: 300000 },
          get_diagnostics: { enabled: true, timeout: 120000 },
        },
        execution: {
          defaultTimeout: 120000,
          trackResources: true,
          maxHistorySize: 1000,
        },
        context: {
          maxTokens: 8000,
          compressionRatio: 0.7,
          workingSetSize: 20,
          fileCacheSize: 10,
        },
        logging: {
          level: 'info',
          errorLogPath: './logs/error.log',
          maxErrorLogs: 100,
        },
        backup: {
          enabled: true,
          retentionDays: 7,
        },
      },
    };
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: ConfigFile): void {
    if (!config.version) {
      throw new Error('Configuration version is missing');
    }

    if (!config.system) {
      throw new Error('System configuration is missing');
    }

    if (!config.system.defaultModel) {
      throw new Error('Default model is not specified');
    }

    if (!config.system.models || Object.keys(config.system.models).length === 0) {
      throw new Error('No models configured');
    }

    if (!config.system.models[config.system.defaultModel]) {
      throw new Error(`Default model '${config.system.defaultModel}' not found in models`);
    }

    // Validate each model
    for (const [name, model] of Object.entries(config.system.models)) {
      if (!model.provider || !['ollama', 'openai'].includes(model.provider)) {
        throw new Error(`Invalid provider for model '${name}': ${model.provider}`);
      }

      if (!model.modelName) {
        throw new Error(`Model name is missing for model '${name}'`);
      }

      if (model.provider === 'openai' && !model.apiKey) {
        console.warn(`Warning: API key is missing for OpenAI model '${name}'`);
      }
    }
  }

  /**
   * Migrate configuration from older version
   */
  private async migrateConfig(config: ConfigFile): Promise<ConfigFile> {
    console.log(`Migrating configuration from version ${config.version} to ${this.currentVersion}...`);

    // Create backup of old config
    const backupPath = this.configPath + `.backup.${config.version}`;
    await fs.writeFile(backupPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`Backup created: ${backupPath}`);

    // Migration logic based on version
    const defaultConfig = this.createDefaultConfig();

    // Merge old config with defaults (preserving user settings)
    const migratedConfig: ConfigFile = {
      version: this.currentVersion,
      system: {
        ...defaultConfig.system,
        ...config.system,
        models: {
          ...defaultConfig.system.models,
          ...(config.system?.models || {}),
        },
        tools: {
          ...defaultConfig.system.tools,
          ...(config.system?.tools || {}),
        },
      },
    };

    return migratedConfig;
  }

  /**
   * Reset to default configuration
   */
  async resetToDefaults(): Promise<void> {
    // Create backup of current config
    if (this.config) {
      const backupPath = this.configPath + `.backup.${Date.now()}`;
      await fs.writeFile(backupPath, JSON.stringify(this.config, null, 2), 'utf-8');
      console.log(`Backup created: ${backupPath}`);
    }

    this.config = this.createDefaultConfig();
    await this.saveConfig();
  }

  /**
   * Export configuration
   */
  exportConfig(): string {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON string
   */
  async importConfig(jsonString: string): Promise<void> {
    const config = JSON.parse(jsonString) as ConfigFile;
    this.validateConfig(config);

    // Create backup of current config
    if (this.config) {
      const backupPath = this.configPath + `.backup.${Date.now()}`;
      await fs.writeFile(backupPath, JSON.stringify(this.config, null, 2), 'utf-8');
    }

    this.config = config;
    await this.saveConfig();
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}

// Global configuration manager instance
export const globalConfigManager = new ConfigManager();

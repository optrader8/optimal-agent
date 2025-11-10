/**
 * Ollama Local Model Implementation
 */

import { ILocalModel } from '../interfaces/ILocalModel.js';
import { ModelConfig, ModelInfo, Context } from '../types.js';
import { getModelEndpoint } from '../config.js';

export class OllamaModel implements ILocalModel {
  private currentModel: string | null = null;
  private config: ModelConfig | null = null;
  private endpoint: string;

  constructor() {
    this.endpoint = getModelEndpoint();
  }

  /**
   * Load a language model
   */
  async loadModel(modelName: string, config: ModelConfig): Promise<boolean> {
    try {
      // Check if model is available
      const response = await fetch(`${this.endpoint}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to connect to Ollama: ${response.statusText}`);
      }

      const data: any = await response.json();
      const models = data.models || [];
      const modelExists = models.some((m: any) => m.name === modelName);

      if (!modelExists) {
        console.warn(
          `Model ${modelName} not found. Available models:`,
          models.map((m: any) => m.name)
        );
        return false;
      }

      this.currentModel = modelName;
      this.config = config;
      return true;
    } catch (error) {
      console.error('Failed to load model:', error);
      return false;
    }
  }

  /**
   * Generate a response from the model
   */
  async generateResponse(prompt: string, context: Context): Promise<string> {
    if (!this.currentModel || !this.config) {
      throw new Error('No model loaded');
    }

    try {
      // Build conversation messages
      const messages = context.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add current prompt
      messages.push({
        role: 'user',
        content: prompt,
      });

      // Call Ollama API
      const response = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.currentModel,
          messages,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens,
          },
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data: any = await response.json();
      return data.message?.content || '';
    } catch (error) {
      console.error('Failed to generate response:', error);
      throw error;
    }
  }

  /**
   * Get information about the loaded model
   */
  getModelInfo(): ModelInfo {
    if (!this.currentModel || !this.config) {
      throw new Error('No model loaded');
    }

    return {
      name: this.currentModel,
      version: '1.0.0',
      contextWindow: this.config.contextWindow,
      capabilities: ['text-generation', 'conversation'],
    };
  }

  /**
   * Switch to a different model
   */
  async switchModel(modelName: string): Promise<boolean> {
    if (!this.config) {
      throw new Error('No configuration available');
    }

    return this.loadModel(modelName, this.config);
  }

  /**
   * Unload the current model
   */
  async unloadModel(): Promise<void> {
    this.currentModel = null;
    this.config = null;
  }
}

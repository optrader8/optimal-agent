/**
 * OpenAI-Compatible Model Implementation
 * Works with OpenAI API and compatible servers (including llama.cpp)
 */

import { ILocalModel } from '../interfaces/ILocalModel.js';
import { ModelConfig, ModelInfo, Context } from '../types.js';
import axios from 'axios';

export class OpenAICompatibleModel implements ILocalModel {
  private currentModel: string | null = null;
  private config: ModelConfig | null = null;
  private apiKey: string;
  private baseUrl: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Load a language model
   */
  async loadModel(modelName: string, config: ModelConfig): Promise<boolean> {
    try {
      // Test connection by listing models
      const response = await axios.get(`${this.baseUrl}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        // axios automatically uses https_proxy environment variable
      });

      console.log('Available models:', response.data.data?.map((m: any) => m.id) || []);

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
      // Build messages array
      const messages = context.messages.map((msg) => ({
        role: msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      // Add current prompt
      messages.push({
        role: 'user',
        content: prompt,
      });

      console.log(`\n[API Request] Sending to ${this.baseUrl}/v1/chat/completions`);
      console.log(`Model: ${this.currentModel}`);
      console.log(`Messages: ${messages.length}`);

      // Call OpenAI-compatible API using axios (supports proxy)
      const response = await axios.post(
        `${this.baseUrl}/v1/chat/completions`,
        {
          model: this.currentModel,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      console.log('[API Response] Received');
      const data: any = response.data;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from model');
      }

      const content = data.choices[0].message?.content || '';
      console.log(`[Response Length] ${content.length} characters`);

      return content;
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
      capabilities: ['text-generation', 'conversation', 'tool-calling'],
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

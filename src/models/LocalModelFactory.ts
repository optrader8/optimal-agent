/**
 * Factory for creating local model instances
 */

import { ILocalModel } from '../interfaces/ILocalModel.js';
import { OllamaModel } from './OllamaModel.js';
import { OpenAICompatibleModel } from './OpenAICompatibleModel.js';

export type ModelProvider = 'ollama' | 'openai' | 'huggingface';

export interface ModelProviderConfig {
  provider: ModelProvider;
  baseUrl?: string;
  apiKey?: string;
}

export class LocalModelFactory {
  /**
   * Create a local model instance based on provider
   */
  static create(
    providerOrConfig: ModelProvider | ModelProviderConfig = 'ollama'
  ): ILocalModel {
    const config =
      typeof providerOrConfig === 'string'
        ? { provider: providerOrConfig }
        : providerOrConfig;

    switch (config.provider) {
      case 'ollama':
        return new OllamaModel();
      case 'openai':
        if (!config.baseUrl || !config.apiKey) {
          throw new Error('OpenAI provider requires baseUrl and apiKey');
        }
        return new OpenAICompatibleModel(config.baseUrl, config.apiKey);
      case 'huggingface':
        // TODO: Implement HuggingFace model
        throw new Error('HuggingFace provider not yet implemented');
      default:
        throw new Error(`Unknown model provider: ${config.provider}`);
    }
  }
}

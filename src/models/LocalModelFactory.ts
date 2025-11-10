/**
 * Factory for creating local model instances
 */

import { ILocalModel } from '../interfaces/ILocalModel.js';
import { OllamaModel } from './OllamaModel.js';

export type ModelProvider = 'ollama' | 'huggingface';

export class LocalModelFactory {
  /**
   * Create a local model instance based on provider
   */
  static create(provider: ModelProvider = 'ollama'): ILocalModel {
    switch (provider) {
      case 'ollama':
        return new OllamaModel();
      case 'huggingface':
        // TODO: Implement HuggingFace model
        throw new Error('HuggingFace provider not yet implemented');
      default:
        throw new Error(`Unknown model provider: ${provider}`);
    }
  }
}

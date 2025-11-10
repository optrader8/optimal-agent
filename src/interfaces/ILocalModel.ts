/**
 * Interface for Local Language Model
 */

import { ModelConfig, ModelInfo, Context } from '../types.js';

export interface ILocalModel {
  /**
   * Load a language model
   */
  loadModel(modelName: string, config: ModelConfig): Promise<boolean>;

  /**
   * Generate a response from the model
   */
  generateResponse(prompt: string, context: Context): Promise<string>;

  /**
   * Get information about the loaded model
   */
  getModelInfo(): ModelInfo;

  /**
   * Switch to a different model
   */
  switchModel(modelName: string): Promise<boolean>;

  /**
   * Unload the current model
   */
  unloadModel(): Promise<void>;
}

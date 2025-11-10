/**
 * Interface for Conversation Manager
 */

import { SessionId, Message } from '../types.js';

export interface IConversationManager {
  /**
   * Start a new conversation session
   */
  startSession(): Promise<SessionId>;

  /**
   * Process a user message and generate response
   */
  processMessage(sessionId: SessionId, message: string): Promise<string>;

  /**
   * Get conversation history for a session
   */
  getConversationHistory(sessionId: SessionId): Promise<Message[]>;

  /**
   * End a conversation session
   */
  endSession(sessionId: SessionId): Promise<void>;
}

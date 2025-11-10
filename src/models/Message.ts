/**
 * Message data model
 */

import { Message as IMessage } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

export class Message implements IMessage {
  id: string;
  timestamp: Date;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, any>;

  constructor(
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata: Record<string, any> = {}
  ) {
    this.id = uuidv4();
    this.timestamp = new Date();
    this.role = role;
    this.content = content;
    this.metadata = metadata;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      timestamp: this.timestamp.toISOString(),
      role: this.role,
      content: this.content,
      metadata: this.metadata,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json: Record<string, any>): Message {
    const message = new Message(json.role, json.content, json.metadata || {});
    message.id = json.id;
    message.timestamp = new Date(json.timestamp);
    return message;
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(this.content.length / 4);
  }
}

/**
 * Conversation Manager implementation
 */

import { IConversationManager } from '../interfaces/IConversationManager.js';
import { SessionId, Message as IMessage } from '../types.js';
import { ILocalModel } from '../interfaces/ILocalModel.js';
import { IParser } from '../interfaces/IParser.js';
import { IToolExecutor } from '../interfaces/IToolExecutor.js';
import { IContextManager } from '../interfaces/IContextManager.js';
import { Message } from '../models/Message.js';
import { v4 as uuidv4 } from 'uuid';

export class ConversationManager implements IConversationManager {
  private sessions: Map<string, string[]> = new Map();

  constructor(
    private model: ILocalModel,
    private parser: IParser,
    private toolExecutor: IToolExecutor,
    private contextManager: IContextManager
  ) {}

  /**
   * Start a new conversation session
   */
  async startSession(): Promise<SessionId> {
    const sessionId = uuidv4();
    this.sessions.set(sessionId, []);

    // Add system message
    const systemMessage = new Message(
      'system',
      'You are a helpful coding assistant with access to file operations, code search, and command execution tools.'
    );
    await this.contextManager.addMessage(sessionId, systemMessage);

    return sessionId;
  }

  /**
   * Process a user message and generate response
   */
  async processMessage(sessionId: SessionId, message: string): Promise<string> {
    // Add user message to context
    const userMessage = new Message('user', message);
    await this.contextManager.addMessage(sessionId, userMessage);

    // Get context
    const context = await this.contextManager.getContext(sessionId, 3000);

    // Generate response from model
    const modelResponse = await this.model.generateResponse(message, context);

    // Parse tool calls from response
    const toolCalls = this.parser.parseToolCalls(modelResponse);

    let finalResponse = modelResponse;

    // Execute tool calls if any
    if (toolCalls.length > 0) {
      let toolResults = '';

      for (const toolCall of toolCalls) {
        // Validate tool call
        const validation = this.parser.validateToolCall(toolCall);

        if (!validation.valid) {
          toolResults += `\n[Tool validation failed: ${validation.errors.join(', ')}]\n`;
          continue;
        }

        // Execute tool
        const result = await this.toolExecutor.executeTool(toolCall);

        if (result.success) {
          toolResults += `\n[Tool: ${toolCall.toolName}]\n${result.output}\n`;
        } else {
          toolResults += `\n[Tool: ${toolCall.toolName} failed: ${result.errorMessage}]\n`;
        }
      }

      // If tools were executed, append results to response
      if (toolResults) {
        finalResponse += '\n\n' + toolResults;
      }
    }

    // Add assistant message to context
    const assistantMessage = new Message('assistant', finalResponse);
    await this.contextManager.addMessage(sessionId, assistantMessage);

    return finalResponse;
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(sessionId: SessionId): Promise<IMessage[]> {
    const context = await this.contextManager.getContext(sessionId, 10000);
    return context.messages;
  }

  /**
   * End a conversation session
   */
  async endSession(sessionId: SessionId): Promise<void> {
    await this.contextManager.clearContext(sessionId);
    this.sessions.delete(sessionId);
  }
}

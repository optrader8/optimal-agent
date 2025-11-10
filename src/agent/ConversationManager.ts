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
    // Extract and track file mentions from user message
    await this.extractAndTrackFileMentions(sessionId, message);

    // Add user message to context
    const userMessage = new Message('user', message);
    await this.contextManager.addMessage(sessionId, userMessage);

    // Get context with enhanced multi-turn information
    const context = await this.contextManager.getContext(sessionId, 3000);

    // Get context summary for better multi-turn understanding
    const contextSummary = await this.contextManager.getContextSummary(sessionId);

    // Enhance the message with context summary if available
    let enhancedMessage = message;
    if (contextSummary) {
      enhancedMessage = `[Context: ${contextSummary}]\n\nUser: ${message}`;
    }

    // Generate response from model
    const modelResponse = await this.model.generateResponse(enhancedMessage, context);

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
          // Record failed validation
          await this.contextManager.recordToolExecution(
            sessionId,
            toolCall.toolName,
            toolCall.parameters,
            false,
            `Validation failed: ${validation.errors.join(', ')}`
          );
          continue;
        }

        // Execute tool
        const result = await this.toolExecutor.executeTool(toolCall);

        // Record tool execution in context for multi-turn tracking
        await this.contextManager.recordToolExecution(
          sessionId,
          toolCall.toolName,
          toolCall.parameters,
          result.success,
          result.output
        );

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

  /**
   * Extract file mentions from user message and track them
   */
  private async extractAndTrackFileMentions(sessionId: SessionId, message: string): Promise<void> {
    // Pattern to detect common file path formats
    const filePatterns = [
      // Quoted paths: "src/index.ts", 'package.json'
      /['"`]([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)['"`]/g,
      // Unquoted paths with extensions: src/index.ts, package.json
      /\b([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)\b/g,
      // Paths mentioned explicitly: "the file at src/main.ts"
      /(?:file|path)\s+(?:at\s+)?([a-zA-Z0-9_\-./]+)/gi,
      // Directory patterns: "src/", "tests/"
      /\b([a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-./]*)/g,
    ];

    const fileMentions = new Set<string>();

    for (const pattern of filePatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const file = match[1];
        if (file && file.length > 1 && !file.startsWith('http')) {
          fileMentions.add(file);
        }
      }
    }

    // Track all mentioned files
    for (const file of fileMentions) {
      await this.contextManager.trackFileMention(sessionId, file);
    }
  }
}

/**
 * Natural Language Parser for tool calls
 */

import { IParser } from '../interfaces/IParser.js';
import { ToolCall, ValidationResult } from '../types.js';
import { ToolCallModel } from '../models/ToolCallModel.js';
import { validateToolCall } from '../utils/validation.js';

export class NaturalLanguageParser implements IParser {
  private availableTools: string[];

  constructor(availableTools: string[]) {
    this.availableTools = availableTools;
  }

  /**
   * Parse tool calls from natural language text
   */
  parseToolCalls(text: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    // Try different parsing patterns
    const parsers = [
      this.parseReadFile.bind(this),
      this.parseWriteFile.bind(this),
      this.parseListDirectory.bind(this),
      this.parseGrepSearch.bind(this),
      this.parseRunCommand.bind(this),
      this.parseFindDefinition.bind(this),
      this.parseEditFile.bind(this),
    ];

    for (const parser of parsers) {
      const result = parser(text);
      if (result) {
        toolCalls.push(result);
      }
    }

    return toolCalls;
  }

  /**
   * Parse read_file patterns
   */
  private parseReadFile(text: string): ToolCall | null {
    const patterns = [
      /(?:read|open|show|display|view)\s+(?:the\s+)?(?:file|content)\s+(?:at\s+)?['"`]?([^'"`\n]+?)['"`]?(?:\s|$|\.)/i,
      /(?:I\s+)?(?:need\s+to|will|let me|going to)\s+read\s+(?:the\s+)?(?:file\s+)?['"`]?([^'"`\n]+?)['"`]?(?:\s|$|\.)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'read_file',
          { path: match[1].trim() },
          0.8,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse write_file patterns
   */
  private parseWriteFile(text: string): ToolCall | null {
    const patterns = [
      /(?:write|create|make|save)\s+(?:a\s+)?(?:file|content)\s+(?:at\s+)?['"`]?([^'"`\n]+?)['"`]?\s+with\s+(?:content|following|this)[\s:]+(.+)/is,
      /(?:I\s+)?(?:will|need to|going to)\s+(?:create|write)\s+(?:a\s+)?(?:file\s+)?['"`]?([^'"`\n]+?)['"`]?\s+with\s+(?:content|following)[\s:]+(.+)/is,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'write_file',
          {
            path: match[1].trim(),
            content: match[2].trim(),
          },
          0.85,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse list_directory patterns
   */
  private parseListDirectory(text: string): ToolCall | null {
    const patterns = [
      /(?:list|show|display)\s+(?:the\s+)?(?:directory|folder|files)\s+(?:at\s+)?['"`]?([^'"`\n]+?)['"`]?(?:\s|$|\.)/i,
      /(?:what's|what is)\s+in\s+(?:the\s+)?(?:directory|folder)\s+['"`]?([^'"`\n]+?)['"`]?(?:\s|$|\.)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'list_directory',
          { path: match[1].trim() },
          0.8,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse grep_search patterns
   */
  private parseGrepSearch(text: string): ToolCall | null {
    const patterns = [
      /(?:search|grep|find)\s+(?:for\s+)?['"`]([^'"`]+?)['"`]/i,
      /(?:I\s+)?(?:will|need to|let me)\s+search\s+(?:for\s+)?['"`]([^'"`]+?)['"`]/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'grep_search',
          {
            pattern: match[1].trim(),
            path: '.',
          },
          0.75,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse run_command patterns
   */
  private parseRunCommand(text: string): ToolCall | null {
    const patterns = [
      /(?:run|execute)\s+(?:the\s+)?(?:command|shell)\s+['"`]([^'"`]+?)['"`]/i,
      /(?:I\s+)?(?:will|need to|let me)\s+run\s+['"`]([^'"`]+?)['"`]/i,
      /running\s+command:\s+['"`]?([^'"`\n]+?)['"`]?(?:\s|$|\.)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'run_command',
          { command: match[1].trim() },
          0.8,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse find_definition patterns
   */
  private parseFindDefinition(text: string): ToolCall | null {
    const patterns = [
      /find\s+(?:the\s+)?definition\s+(?:of\s+)?['"`]?(\w+)['"`]?/i,
      /(?:where\s+is|locate)\s+(?:the\s+)?(?:function|class)\s+['"`]?(\w+)['"`]?\s+defined/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'find_definition',
          { symbol: match[1].trim() },
          0.75,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse edit_file patterns
   */
  private parseEditFile(text: string): ToolCall | null {
    const patterns = [
      /(?:edit|modify|change)\s+(?:the\s+)?(?:file\s+)?['"`]?([^'"`\n]+?)['"`]?\s+(?:to|by)\s+(.+)/is,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'edit_file',
          {
            path: match[1].trim(),
            changes: match[2].trim(),
          },
          0.7,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Extract parameters for a specific tool type
   */
  extractParameters(text: string, toolType: string): Record<string, any> {
    const toolCalls = this.parseToolCalls(text);
    const relevantCall = toolCalls.find((tc) => tc.toolName === toolType);
    return relevantCall?.parameters || {};
  }

  /**
   * Validate a parsed tool call
   */
  validateToolCall(toolCall: ToolCall): ValidationResult {
    return validateToolCall(toolCall, this.availableTools);
  }
}

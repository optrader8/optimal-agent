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
      this.parseNodeEval.bind(this),
      this.parseReadFile.bind(this),
      this.parseWriteFile.bind(this),
      this.parseListDirectory.bind(this),
      this.parseFileTree.bind(this),
      this.parseFileStat.bind(this),
      this.parseGrepSearch.bind(this),
      this.parseRipgrep.bind(this),
      this.parseFind.bind(this),
      this.parseAwk.bind(this),
      this.parseSed.bind(this),
      this.parseWc.bind(this),
      this.parseRunCommand.bind(this),
      this.parseFindDefinition.bind(this),
      this.parseEditFile.bind(this),
      this.parseGetFileOutline.bind(this),
      this.parseApplyDiff.bind(this),
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
      /(?:show|display)\s+(?:me\s+)?(?:the\s+)?(?:directory|folder)\s+structure/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'list_directory',
          { path: match[1]?.trim() || '.' },
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
      /(?:run|execute)\s+(?:the\s+)?(?:command|shell)\s+(?:command:?\s+)?['"`]?([^'"`\n]+?)['"`]?(?:\s|$|\.)/i,
      /(?:I\s+)?(?:will|'ll|need to|let me)\s+run\s+['"`]([^'"`]+?)['"`]/i,
      /running\s+command:\s+['"`]?([^'"`\n]+?)['"`]?(?:\s|$|\.)/i,
      /execute\s+(?:shell\s+)?command:\s+(\w+)/i,
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
   * Parse Node.js code evaluation patterns
   */
  private parseNodeEval(text: string): ToolCall | null {
    const patterns = [
      /(?:execute|run|eval)?\s*fs\.(\w+)\s*\([^)]*\)/i,
      /(?:execute|run|eval)?\s*path\.(\w+)\s*\([^)]*\)/i,
      /(?:execute|run|eval)?\s*(?:await\s+)?(\w+\.\w+\([^)]*\))/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Extract the full code snippet
        const codeMatch = text.match(/```(?:javascript|js|typescript|ts)?\n?([\s\S]*?)```/);
        const code = codeMatch ? codeMatch[1] : match[0];

        return new ToolCallModel(
          'node_eval',
          { code: code.trim() },
          0.85,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse file_tree patterns
   */
  private parseFileTree(text: string): ToolCall | null {
    const patterns = [
      /(?:show|display|get)\s+(?:the\s+)?(?:file\s+)?tree\s+(?:of|for|at)?\s*['"`]?([^'"`\n]*?)['"`]?(?:\s|$|\.)/i,
      /(?:tree|structure)\s+(?:of\s+)?['"`]?([^'"`\n]*?)['"`]?(?:\s|$|\.)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'file_tree',
          { path: match[1]?.trim() || '.', depth: 3 },
          0.75,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse file_stat patterns
   */
  private parseFileStat(text: string): ToolCall | null {
    const patterns = [
      /(?:get|show|check)\s+(?:file\s+)?(?:stats?|info|metadata|details)\s+(?:for|of|on)\s+['"`]?([^'"`\n]+?)['"`]?(?:\s|$|\.)/i,
      /fs\.stat\s*\(\s*['"`]([^'"`]+?)['"`]\s*\)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'file_stat',
          { path: match[1].trim() },
          0.85,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse ripgrep patterns
   */
  private parseRipgrep(text: string): ToolCall | null {
    const patterns = [
      /(?:ripgrep|rg)\s+['"`]([^'"`]+?)['"`]/i,
      /(?:use\s+)?(?:ripgrep|rg)\s+(?:to\s+)?search\s+(?:for\s+)?['"`]([^'"`]+?)['"`]/i,
      /search\s+(?:with\s+)?(?:ripgrep|rg)\s+(?:for\s+)?['"`]([^'"`]+?)['"`]/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'ripgrep',
          { pattern: match[1].trim(), path: '.' },
          0.8,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse find patterns
   */
  private parseFind(text: string): ToolCall | null {
    const patterns = [
      /find\s+(?:files?\s+)?(?:named|matching)\s+['"`]([^'"`]+?)['"`]/i,
      /(?:locate|search for)\s+files?\s+(?:named|called)\s+['"`]([^'"`]+?)['"`]/i,
      /(?:locate|find)\s+(?:files?\s+)?(?:matching|called|named)\s+['"`]([^'"`]+?)['"`]/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'find',
          { name: match[1].trim(), path: '.' },
          0.75,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse awk patterns
   */
  private parseAwk(text: string): ToolCall | null {
    const patterns = [
      /awk\s+['"`]([^'"`]+?)['"`](?:\s+['"`]([^'"`]+?)['"`])?/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const params: any = { script: match[1].trim() };
        if (match[2]) {
          params.file = match[2].trim();
        }
        return new ToolCallModel('awk', params, 0.8, match[0]);
      }
    }

    return null;
  }

  /**
   * Parse sed patterns
   */
  private parseSed(text: string): ToolCall | null {
    const patterns = [
      /sed\s+['"`]([^'"`]+?)['"`]\s+['"`]([^'"`]+?)['"`]/i,
      /sed\s+['"`]([^'"`\s]+?)['"`]\s+(\S+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'sed',
          { script: match[1].trim(), file: match[2].trim() },
          0.8,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse wc patterns
   */
  private parseWc(text: string): ToolCall | null {
    const patterns = [
      /(?:count|wc)\s+(?:lines|words|chars)?\s+(?:in\s+)?['"`]?([^'"`\n]+?)['"`]?(?:\s|$|\.)/i,
      /wc\s+(?:-[lwc]\s+)?['"`]?([^'"`\n]+?)['"`]?(?:\s|$|\.)/i,
      /how\s+many\s+(?:lines|words)\s+(?:are\s+)?in\s+['"`]?([^'"`\n]+?)['"`]?(?:\s|$|\.)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'wc',
          { path: match[1].trim() },
          0.75,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse get_file_outline patterns
   */
  private parseGetFileOutline(text: string): ToolCall | null {
    const patterns = [
      /(?:get|show|display)\s+(?:the\s+)?(?:file\s+)?(?:outline|structure|summary)\s+(?:of|for)\s+['"`]?([^'"`\n]+?)['"`]?(?:\s|$|\.)/i,
      /(?:outline|summarize)\s+['"`]?([^'"`\n]+?)['"`]?(?:\s|$|\.)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return new ToolCallModel(
          'get_file_outline',
          { path: match[1].trim() },
          0.75,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse apply_diff patterns
   */
  private parseApplyDiff(text: string): ToolCall | null {
    const patterns = [
      /apply\s+(?:the\s+)?(?:diff|patch)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Try to extract diff content from code block
        const diffMatch = text.match(/```(?:diff)?\n?([\s\S]*?)```/);
        if (diffMatch) {
          return new ToolCallModel(
            'apply_diff',
            { diff: diffMatch[1].trim(), targetPath: '.' },
            0.8,
            match[0]
          );
        }
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

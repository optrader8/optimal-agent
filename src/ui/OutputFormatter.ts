/**
 * Output Formatter
 * Formats and highlights output for better readability
 */

import chalk from 'chalk';

export interface CodeBlock {
  language: string;
  code: string;
  startLine?: number;
}

export class OutputFormatter {
  /**
   * Format code with syntax highlighting
   */
  formatCode(code: string, language?: string): string {
    const lang = language?.toLowerCase() || this.detectLanguage(code);

    // Add line numbers and basic syntax highlighting
    const lines = code.split('\n');
    const lineNumWidth = String(lines.length).length;

    return lines
      .map((line, idx) => {
        const lineNum = chalk.gray(String(idx + 1).padStart(lineNumWidth, ' ') + ' │ ');
        const highlighted = this.highlightLine(line, lang);
        return lineNum + highlighted;
      })
      .join('\n');
  }

  /**
   * Format code block with header
   */
  formatCodeBlock(block: CodeBlock): string {
    const header = chalk.bgBlue.white.bold(` ${block.language} `);
    const code = this.formatCode(block.code, block.language);
    const separator = chalk.gray('─'.repeat(80));

    return `${header}\n${separator}\n${code}\n${separator}`;
  }

  /**
   * Highlight a single line based on language
   */
  private highlightLine(line: string, language: string): string {
    switch (language) {
      case 'javascript':
      case 'typescript':
      case 'js':
      case 'ts':
        return this.highlightJavaScript(line);
      case 'python':
      case 'py':
        return this.highlightPython(line);
      case 'json':
        return this.highlightJSON(line);
      case 'markdown':
      case 'md':
        return this.highlightMarkdown(line);
      default:
        return this.highlightGeneric(line);
    }
  }

  /**
   * Highlight JavaScript/TypeScript
   */
  private highlightJavaScript(line: string): string {
    // Comments
    if (line.trim().startsWith('//')) {
      return chalk.gray(line);
    }
    if (line.trim().startsWith('/*') || line.trim().startsWith('*')) {
      return chalk.gray(line);
    }

    // Keywords
    const keywords = /\b(const|let|var|function|class|if|else|for|while|return|import|export|from|async|await|try|catch|throw|new|this|super|extends|implements|interface|type|enum|public|private|protected|static|readonly)\b/g;
    line = line.replace(keywords, (match) => chalk.magenta(match));

    // Strings
    line = line.replace(/(["'`])((?:\\\1|(?!\1).)*?)\1/g, (match) => chalk.green(match));

    // Numbers
    line = line.replace(/\b(\d+\.?\d*)\b/g, (match) => chalk.yellow(match));

    // Functions
    line = line.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, (match, name) => chalk.cyan(name) + '(');

    // Operators
    line = line.replace(/([=+\-*/<>!&|]+)/g, (match) => chalk.red(match));

    return line;
  }

  /**
   * Highlight Python
   */
  private highlightPython(line: string): string {
    // Comments
    if (line.trim().startsWith('#')) {
      return chalk.gray(line);
    }

    // Keywords
    const keywords = /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|lambda|yield|async|await|True|False|None|and|or|not|in|is)\b/g;
    line = line.replace(keywords, (match) => chalk.magenta(match));

    // Strings
    line = line.replace(/(["'])((?:\\\1|(?!\1).)*?)\1/g, (match) => chalk.green(match));
    line = line.replace(/(""")([\s\S]*?)(""")/g, (match) => chalk.green(match));
    line = line.replace(/('''')([\s\S]*?)('''')/g, (match) => chalk.green(match));

    // Numbers
    line = line.replace(/\b(\d+\.?\d*)\b/g, (match) => chalk.yellow(match));

    // Functions
    line = line.replace(/\bdef\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, name) => 'def ' + chalk.cyan(name));

    // Decorators
    line = line.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (match) => chalk.blue(match));

    return line;
  }

  /**
   * Highlight JSON
   */
  private highlightJSON(line: string): string {
    // Keys
    line = line.replace(/"([^"]+)":/g, (match, key) => chalk.cyan(`"${key}"`) + ':');

    // Strings
    line = line.replace(/:\s*"([^"]*)"/g, (match, value) => ': ' + chalk.green(`"${value}"`));

    // Numbers
    line = line.replace(/:\s*(\d+\.?\d*)/g, (match, num) => ': ' + chalk.yellow(num));

    // Booleans
    line = line.replace(/:\s*(true|false|null)/g, (match, bool) => ': ' + chalk.magenta(bool));

    return line;
  }

  /**
   * Highlight Markdown
   */
  private highlightMarkdown(line: string): string {
    // Headers
    if (line.match(/^#{1,6}\s/)) {
      return chalk.bold.blue(line);
    }

    // Bold
    line = line.replace(/\*\*([^*]+)\*\*/g, (match, text) => chalk.bold(text));

    // Italic
    line = line.replace(/\*([^*]+)\*/g, (match, text) => chalk.italic(text));

    // Code
    line = line.replace(/`([^`]+)`/g, (match, code) => chalk.bgGray(code));

    // Links
    line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => chalk.blue(text) + chalk.gray(` (${url})`));

    return line;
  }

  /**
   * Generic highlighting (for unknown languages)
   */
  private highlightGeneric(line: string): string {
    // Comments (// or # or /*)
    if (line.trim().match(/^(\/\/|#|\/\*|\*)/)) {
      return chalk.gray(line);
    }

    // Strings
    line = line.replace(/(["'`])((?:\\\1|(?!\1).)*?)\1/g, (match) => chalk.green(match));

    // Numbers
    line = line.replace(/\b(\d+\.?\d*)\b/g, (match) => chalk.yellow(match));

    return line;
  }

  /**
   * Detect language from code content
   */
  private detectLanguage(code: string): string {
    // TypeScript/JavaScript detection
    if (code.match(/\b(const|let|var|function|class|=>|interface|type)\b/)) {
      return 'javascript';
    }

    // Python detection
    if (code.match(/\b(def|class|import|from|if|elif)\b/) || code.match(/:\s*$/m)) {
      return 'python';
    }

    // JSON detection
    if (code.trim().startsWith('{') || code.trim().startsWith('[')) {
      try {
        JSON.parse(code);
        return 'json';
      } catch {}
    }

    // Markdown detection
    if (code.match(/^#{1,6}\s/m) || code.match(/\[.*\]\(.*\)/)) {
      return 'markdown';
    }

    return 'text';
  }

  /**
   * Format file path with highlighting
   */
  formatFilePath(path: string, exists: boolean = true): string {
    const parts = path.split('/');
    const fileName = parts[parts.length - 1];
    const dirPath = parts.slice(0, -1).join('/');

    if (exists) {
      return chalk.gray(dirPath + '/') + chalk.cyan.bold(fileName);
    } else {
      return chalk.gray(dirPath + '/') + chalk.red.bold(fileName);
    }
  }

  /**
   * Format error message
   */
  formatError(error: string, details?: string): string {
    let output = chalk.red.bold('❌ Error: ') + chalk.red(error);

    if (details) {
      output += '\n' + chalk.gray(details);
    }

    return output;
  }

  /**
   * Format success message
   */
  formatSuccess(message: string, details?: string): string {
    let output = chalk.green.bold('✓ ') + chalk.green(message);

    if (details) {
      output += '\n' + chalk.gray(details);
    }

    return output;
  }

  /**
   * Format warning message
   */
  formatWarning(message: string, details?: string): string {
    let output = chalk.yellow.bold('⚠️  Warning: ') + chalk.yellow(message);

    if (details) {
      output += '\n' + chalk.gray(details);
    }

    return output;
  }

  /**
   * Format info message
   */
  formatInfo(message: string, details?: string): string {
    let output = chalk.blue.bold('ℹ️  ') + chalk.blue(message);

    if (details) {
      output += '\n' + chalk.gray(details);
    }

    return output;
  }

  /**
   * Format diff output
   */
  formatDiff(oldLine: string, newLine: string): string {
    const removed = chalk.red('- ' + oldLine);
    const added = chalk.green('+ ' + newLine);
    return removed + '\n' + added;
  }

  /**
   * Format table
   */
  formatTable(headers: string[], rows: string[][]): string {
    const columnWidths = headers.map((header, i) => {
      const maxRowWidth = Math.max(...rows.map(row => (row[i] || '').length));
      return Math.max(header.length, maxRowWidth);
    });

    // Header
    const headerRow = headers
      .map((header, i) => chalk.bold(header.padEnd(columnWidths[i])))
      .join(' │ ');

    const separator = columnWidths.map(w => '─'.repeat(w)).join('─┼─');

    // Rows
    const dataRows = rows.map(row =>
      row.map((cell, i) => (cell || '').padEnd(columnWidths[i])).join(' │ ')
    );

    return [headerRow, chalk.gray(separator), ...dataRows].join('\n');
  }

  /**
   * Format list
   */
  formatList(items: string[], numbered: boolean = false): string {
    return items
      .map((item, idx) => {
        const marker = numbered ? chalk.gray(`${idx + 1}.`) : chalk.gray('•');
        return `  ${marker} ${item}`;
      })
      .join('\n');
  }

  /**
   * Format key-value pairs
   */
  formatKeyValue(pairs: Record<string, string>): string {
    const maxKeyLength = Math.max(...Object.keys(pairs).map(k => k.length));

    return Object.entries(pairs)
      .map(([key, value]) => {
        const paddedKey = key.padEnd(maxKeyLength);
        return `  ${chalk.cyan(paddedKey)}: ${value}`;
      })
      .join('\n');
  }

  /**
   * Create a box around text
   */
  formatBox(title: string, content: string, width: number = 80): string {
    const topBorder = '┌' + '─'.repeat(width - 2) + '┐';
    const bottomBorder = '└' + '─'.repeat(width - 2) + '┘';

    const titleLine = '│ ' + chalk.bold(title) + ' '.repeat(width - title.length - 3) + '│';
    const separator = '├' + '─'.repeat(width - 2) + '┤';

    const contentLines = content.split('\n').map(line => {
      const trimmed = line.substring(0, width - 4);
      return '│ ' + trimmed + ' '.repeat(width - trimmed.length - 3) + '│';
    });

    return [
      chalk.gray(topBorder),
      titleLine,
      chalk.gray(separator),
      ...contentLines,
      chalk.gray(bottomBorder),
    ].join('\n');
  }

  /**
   * Format progress bar
   */
  formatProgressBar(current: number, total: number, width: number = 40): string {
    const percentage = Math.floor((current / total) * 100);
    const filled = Math.floor((current / total) * width);
    const empty = width - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const text = ` ${current}/${total} (${percentage}%)`;

    return bar + text;
  }

  /**
   * Extract and format code blocks from text
   */
  extractAndFormatCodeBlocks(text: string): string {
    // Match markdown code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

    return text.replace(codeBlockRegex, (match, language, code) => {
      const block: CodeBlock = {
        language: language || 'text',
        code: code.trim(),
      };
      return '\n' + this.formatCodeBlock(block) + '\n';
    });
  }

  /**
   * Format inline code
   */
  formatInlineCode(text: string): string {
    return text.replace(/`([^`]+)`/g, (match, code) => chalk.bgGray.white(` ${code} `));
  }
}

// Global output formatter instance
export const globalOutputFormatter = new OutputFormatter();

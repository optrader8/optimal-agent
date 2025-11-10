/**
 * Korean Language Parser
 * Parses Korean natural language commands to tool calls
 */

import { ToolCall } from '../types.js';
import { ToolCallModel } from '../models/ToolCallModel.js';

export class KoreanParser {
  /**
   * Parse read_file patterns in Korean
   */
  parseReadFile(text: string): ToolCall | null {
    const patterns = [
      /(['"`]?([^'"`\s]+\.\w+)['"`]?)\s*(?:파일을?|을?를?)\s*(?:읽어|읽어줘|읽어라|보여줘|확인해|열어)/,
      /(?:파일|내용)\s*(['"`]?([^'"`\s]+\.\w+)['"`]?)\s*(?:읽어|보여|확인)/,
      /(['"`]?([^'"`\s]+\.\w+)['"`]?)\s*(?:내용|코드)\s*(?:보여|확인)/,
      /(['"`]?([^'"`]+)['"`]?)\s*(?:파일의?\s*)?(?:내용|코드)(?:을?를?)?\s*(?:읽어|보여|확인|출력)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const path = match[2] || match[1];
        return new ToolCallModel(
          'read_file',
          { path: path.replace(/['""`]/g, '') },
          0.85,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse write_file patterns in Korean
   */
  parseWriteFile(text: string): ToolCall | null {
    const patterns = [
      /(['"`]?([^'"`\s]+\.\w+)['"`]?)\s*(?:파일(?:에|을))?\s*(?:다음|아래)\s*(?:내용|코드)(?:을?를?)?\s*(?:작성|생성|만들어|저장)[\s:：]*(.+)/is,
      /(['"`]?([^'"`\s]+\.\w+)['"`]?)\s*(?:파일(?:을?를?))?\s*(?:생성|작성|만들어).*?(?:내용|코드)[\s:：]+(.+)/is,
      /(['"`]?([^'"`]+)['"`]?)\s*(?:라는\s*)?(?:파일을?|을?를?)\s*(?:만들고|작성하고|생성하고).*?(?:내용|코드)[\s:：]*(.+)/is,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const path = (match[2] || match[1]).replace(/['""`]/g, '');
        const content = match[3].trim();
        return new ToolCallModel(
          'write_file',
          { path, content },
          0.85,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse list_directory patterns in Korean
   */
  parseListDirectory(text: string): ToolCall | null {
    const patterns = [
      /(['"`]?([^'"`\s]+)['"`]?)\s*(?:디렉토리|폴더|경로)(?:의|에\s*있는)?\s*(?:파일|내용|목록)(?:을?를?)?\s*(?:보여|확인|나열|출력)/,
      /(?:디렉토리|폴더|경로)\s*(['"`]?([^'"`\s]+)['"`]?)\s*(?:파일|내용|목록)/,
      /(['"`]?([^'"`\s]+)['"`]?)\s*(?:안에|에)\s*(?:뭐가|무엇이|어떤\s*파일이)\s*(?:있는지|있어)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const path = (match[2] || match[1]).replace(/['""`]/g, '');
        return new ToolCallModel(
          'list_directory',
          { path },
          0.8,
          match[0]
        );
      }
    }

    return null;
  }

  /**
   * Parse file_tree patterns in Korean
   */
  parseFileTree(text: string): ToolCall | null {
    const patterns = [
      /(?:파일|디렉토리|폴더)\s*(?:구조|트리|계층)(?:을?를?)?\s*(?:보여|확인|출력)/,
      /(?:프로젝트|디렉토리)\s*(?:전체\s*)?구조/,
      /(?:디렉토리|폴더)\s*(['"`]?([^'"`\s]+)['"`]?)\s*(?:트리|구조)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const params: Record<string, any> = {};

        if (match[2]) {
          params.path = match[2].replace(/['""`]/g, '');
        }

        // Extract depth
        const depthMatch = text.match(/(?:깊이|레벨|depth)\s*(\d+)/);
        if (depthMatch) {
          params.depth = parseInt(depthMatch[1]);
        }

        return new ToolCallModel('file_tree', params, 0.8, match[0]);
      }
    }

    return null;
  }

  /**
   * Parse grep_search patterns in Korean
   */
  parseGrepSearch(text: string): ToolCall | null {
    const patterns = [
      /(['"`]([^'"`]+)['"`])\s*(?:패턴|문자열|텍스트)(?:을?를?)?\s*(?:검색|찾아|찾기)/,
      /(['"`]([^'"`]+)['"`])\s*(?:을?를?|이?가?)\s*(?:포함하는|들어있는)\s*(?:파일|코드)/,
      /(?:파일에서|코드에서)\s*(['"`]([^'"`]+)['"`])\s*(?:검색|찾기)/,
      /(['"`]?([^'"`\s]+)['"`]?)\s*(?:이?가?)\s*(?:어디에|어디|몇\s*번\s*째\s*줄에?)\s*(?:있는지|있어|나오는지)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const searchPattern = match[2] || match[1];
        const params: Record<string, any> = {
          pattern: searchPattern.replace(/['""`]/g, ''),
        };

        // Extract path/directory
        const pathMatch = text.match(/(['"`]?([^'"`\s]+\.\w+)['"`]?)\s*(?:파일|에서)/);
        if (pathMatch) {
          params.path = pathMatch[2].replace(/['""`]/g, '');
        }

        return new ToolCallModel('grep_search', params, 0.8, match[0]);
      }
    }

    return null;
  }

  /**
   * Parse run_command patterns in Korean
   */
  parseRunCommand(text: string): ToolCall | null {
    const patterns = [
      /(['"`]([^'"`]+)['"`])\s*(?:명령어?|커맨드)(?:을?를?)?\s*(?:실행|수행|돌려)/,
      /(?:명령어?|커맨드)\s*(['"`]([^'"`]+)['"`])\s*(?:실행|수행)/,
      /(['"`]?([^'"`\s]+)['"`]?)\s*(?:빌드|테스트|실행|컴파일)(?:해?줘?|하라|해라)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const command = (match[2] || match[1]).replace(/['""`]/g, '');
        return new ToolCallModel(
          'run_command',
          { command },
          0.8,
          match[0]
        );
      }
    }

    // Common commands without quotes
    if (text.match(/npm\s+(install|build|test|start)/)) {
      return new ToolCallModel(
        'run_command',
        { command: text.match(/npm\s+\w+/)![0] },
        0.9,
        text
      );
    }

    return null;
  }

  /**
   * Parse edit_file patterns in Korean
   */
  parseEditFile(text: string): ToolCall | null {
    const patterns = [
      /(['"`]?([^'"`\s]+\.\w+)['"`]?)\s*(?:파일의?)?\s*(\d+)\s*(?:번|번째)\s*줄(?:을?를?)?\s*(['"`]([^'"`]+)['"`])\s*(?:으로|로)\s*(?:수정|변경|바꿔)/,
      /(['"`]?([^'"`\s]+\.\w+)['"`]?)\s*(?:에서|파일에서)\s*(['"`]([^'"`]+)['"`])\s*(?:을?를?)\s*(['"`]([^'"`]+)['"`])\s*(?:으로|로)\s*(?:수정|변경|교체)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const params: Record<string, any> = {
          path: (match[2] || match[1]).replace(/['""`]/g, ''),
        };

        // Line-based edit
        if (match[3] && match[3].match(/^\d+$/)) {
          params.line = parseInt(match[3]);
          params.newContent = (match[5] || match[4]).replace(/['""`]/g, '');
        } else {
          // Pattern-based edit
          params.oldContent = (match[4] || match[3]).replace(/['""`]/g, '');
          params.newContent = (match[6] || match[5]).replace(/['""`]/g, '');
        }

        return new ToolCallModel('edit_file', params, 0.85, match[0]);
      }
    }

    return null;
  }

  /**
   * Parse find_symbol patterns in Korean
   */
  parseFindSymbol(text: string): ToolCall | null {
    const patterns = [
      /(['"`]?([^'"`\s]+)['"`]?)\s*(?:함수|클래스|인터페이스|타입)(?:을?를?|이?가?)\s*(?:찾아|검색|어디)/,
      /(?:함수|클래스|인터페이스|타입)\s*(['"`]?([^'"`\s]+)['"`]?)\s*(?:찾아|검색|어디)/,
      /(['"`]?([^'"`\s]+)['"`]?)\s*(?:이?가?)\s*(?:어디에|어느\s*파일에)\s*(?:정의|선언|구현)/,
      /(?:모든|전체)\s*(?:함수|클래스|인터페이스)(?:들?)\s*(?:보여|나열|찾아)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const params: Record<string, any> = {};

        // Extract name if present
        if (match[2] || match[1]) {
          params.name = (match[2] || match[1]).replace(/['""`]/g, '');
        } else {
          params.name = '.*'; // Search all
        }

        // Detect kind from Korean keywords
        if (text.match(/함수/)) {
          params.kind = 'function';
        } else if (text.match(/클래스/)) {
          params.kind = 'class';
        } else if (text.match(/인터페이스/)) {
          params.kind = 'interface';
        } else if (text.match(/타입/)) {
          params.kind = 'type';
        }

        // Extract directory
        const dirMatch = text.match(/(['"`]?([^'"`\s]+)['"`]?)\s*(?:디렉토리|폴더|경로)(?:에서|에|의)/);
        if (dirMatch) {
          params.directory = dirMatch[2].replace(/['""`]/g, '');
        }

        return new ToolCallModel('find_symbol', params, 0.85, match[0]);
      }
    }

    return null;
  }

  /**
   * Parse run_tests patterns in Korean
   */
  parseRunTests(text: string): ToolCall | null {
    const patterns = [
      /(?:테스트|test)(?:를?|을?)?\s*(?:실행|수행|돌려|해)/,
      /(?:유닛|단위)\s*테스트/,
      /(?:jest|mocha|vitest|pytest)\s*(?:실행|수행)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const params: Record<string, any> = {};

        // Extract path
        const pathMatch = text.match(/(['"`]?([^'"`\s]+)['"`]?)\s*(?:파일|경로)/);
        if (pathMatch) {
          params.path = pathMatch[2].replace(/['""`]/g, '');
        }

        // Check for coverage request
        if (text.match(/커버리지|coverage/)) {
          params.coverage = true;
        }

        return new ToolCallModel('run_tests', params, 0.8, match[0]);
      }
    }

    return null;
  }

  /**
   * Parse get_diagnostics patterns in Korean
   */
  parseGetDiagnostics(text: string): ToolCall | null {
    const patterns = [
      /(?:린트|lint|eslint)(?:를?|을?)?\s*(?:실행|수행|검사)/,
      /(?:타입|type)\s*(?:체크|검사|확인)/,
      /(?:코드|파일)\s*(?:에러|오류|문제|이슈)(?:를?|을?)?\s*(?:검사|확인|찾아)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const params: Record<string, any> = {};

        // Detect diagnostic type
        if (text.match(/린트|lint|eslint/)) {
          params.type = 'lint';
        } else if (text.match(/타입|type|tsc/)) {
          params.type = 'typecheck';
        }

        // Check for auto-fix
        if (text.match(/수정|고쳐|fix/)) {
          params.fix = true;
        }

        return new ToolCallModel('get_diagnostics', params, 0.8, match[0]);
      }
    }

    return null;
  }

  /**
   * Check if text is primarily in Korean
   */
  isKorean(text: string): boolean {
    const koreanChars = text.match(/[가-힣]/g);
    return koreanChars !== null && koreanChars.length > 5;
  }
}

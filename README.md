# Optimal Agent

로컬 환경에서 실행 가능한 소형 언어 모델을 활용한 코딩 에이전트

## Features

- **Multi-turn Conversations**: 지속적인 대화 컨텍스트 유지
- **Natural Language Tool Calling**: Tool calling API 없이 자연어 파싱으로 툴 실행
- **Comprehensive Tools**: 코드베이스 탐색, 편집, 실행을 위한 다양한 툴 제공
- **Local-First**: 프라이버시 보장 및 인터넷 연결 불필요
- **Model Agnostic**: GPT-OSS-20B, Qwen, Gemma 등 다양한 로컬 모델 지원

## Supported Models

- GPT-OSS-20B
- Qwen (7B/14B/72B)
- Gemma (2B/7B)
- 기타 로컬 실행 가능한 언어 모델

## Installation

```bash
# Clone repository
git clone https://github.com/your-username/optimal-agent.git
cd optimal-agent

# Install dependencies
pnpm install

# Setup local model (example with Ollama)
ollama pull qwen:7b
```

## Usage

```bash
# Start the agent
pnpm start

# With specific model
pnpm start --model qwen:7b
```

## Available Tools

### File Operations
- Read, write, list files and directories
- File tree visualization

### Code Search
- Grep search with pattern matching
- Find definitions and references
- File structure outline

### Code Modification
- Edit files with natural language instructions
- Apply diff patches
- Refactor and rename symbols

### Execution
- Run shell commands
- Execute tests
- Get diagnostics (lint, type check)

## Architecture

```
optimal-agent/
├── src/
│   ├── agent/           # Core agent logic
│   ├── tools/           # Tool implementations
│   ├── parsers/         # Natural language parsers
│   ├── models/          # Model integrations
│   └── context/         # Context management
├── tests/               # Test suites
└── docs/                # Documentation
```

## Development

```bash
# Run in development mode
pnpm dev

# Run tests
pnpm test

# Lint code
pnpm lint
```

## Configuration

Create a `.env` file:

```env
MODEL_NAME=qwen:7b
MODEL_ENDPOINT=http://localhost:11434
CONTEXT_WINDOW=4096
MAX_TOKENS=2048
```

## Contributing

Contributions are welcome! Please read [IDEA.md](./IDEA.md) for project concept and design decisions.

## License

MIT

## Related Projects

- [Aider](https://github.com/paul-gauthier/aider) - AI pair programming
- [Cursor](https://cursor.sh/) - AI-first code editor
- [Continue](https://continue.dev/) - Open-source autopilot for VS Code

## Acknowledgments

Built for developers who want to use AI coding assistants without relying on cloud APIs.
# optimal-agent

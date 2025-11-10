# Optimal Agent - Project Concept

## Overview
로컬 환경에서 실행 가능한 소형 언어 모델(GPT-OSS-20B, Qwen, Gemma 등)을 활용한 코딩 에이전트 프로젝트입니다. Tool calling 기능이 제한적인 로컬 모델들도 효과적으로 활용할 수 있도록 설계되었습니다.

## Core Requirements

### 1. Multi-turn Conversation Support
- **지속적인 대화 컨텍스트 유지**: 여러 턴에 걸친 대화를 자연스럽게 이어갈 수 있어야 함
- **컨텍스트 관리**: 이전 대화 내용과 작업 이력을 효율적으로 관리
- **상태 유지**: 현재 작업 상태, 파일 변경 사항, 진행 중인 태스크 추적
- **메모리 최적화**: 제한된 컨텍스트 윈도우 내에서 중요한 정보 우선 보존

### 2. Natural Language Tool Invocation
- **자연어 분석 기반 툴 호출**: Tool calling API가 없어도 자연어 출력을 파싱하여 툴 실행
- **패턴 매칭 시스템**: 모델의 응답에서 툴 호출 의도를 추출
- **구조화된 출력 유도**: 프롬프트 엔지니어링을 통해 일관된 형식의 응답 유도
- **Fallback 메커니즘**: 파싱 실패 시 사용자 확인 또는 재시도

**예시 패턴:**
```
Model Output: "I need to read the file at src/main.py"
→ Parsed Action: read_file("src/main.py")

Model Output: "Let me search for the function definition: grep 'def calculate'"
→ Parsed Action: grep_search("def calculate")
```

### 3. Comprehensive Codebase Exploration Tools
로컬 모델이 코드베이스를 자유롭게 탐색할 수 있도록 다음 툴들을 제공:

#### File Operations
- `read_file(path)`: 파일 내용 읽기
- `write_file(path, content)`: 파일 생성/수정
- `list_directory(path)`: 디렉토리 구조 탐색
- `file_tree(path, depth)`: 트리 구조로 파일 시스템 표시

#### Code Search & Analysis
- `grep_search(pattern, path)`: 코드 패턴 검색
- `find_definition(symbol)`: 함수/클래스 정의 찾기
- `find_references(symbol)`: 심볼 사용처 검색
- `get_file_outline(path)`: 파일 구조 요약 (함수/클래스 목록)

#### Code Modification
- `edit_file(path, changes)`: 부분 편집
- `apply_diff(path, diff)`: diff 패치 적용
- `refactor_rename(old_name, new_name)`: 심볼 일괄 변경

#### Execution & Testing
- `run_command(cmd)`: 셸 명령어 실행
- `run_tests(path)`: 테스트 실행
- `get_diagnostics(path)`: 린트/타입 체크 결과

#### Context Management
- `summarize_file(path)`: 파일 내용 요약
- `get_dependencies(path)`: 의존성 그래프
- `get_git_diff()`: 변경 사항 확인

## Technical Challenges

### 1. 제한된 모델 능력 보완
- 작은 모델도 효과적으로 사용할 수 있도록 태스크 분해
- 명확한 지시사항과 예시 제공
- 단계별 가이드를 통한 복잡한 작업 수행

### 2. 툴 호출 정확도 향상
- Few-shot learning을 통한 출력 형식 학습
- 검증 로직을 통한 잘못된 툴 호출 방지
- 사용자 피드백 루프 구축

### 3. 컨텍스트 윈도우 최적화
- 중요도 기반 컨텍스트 압축
- 요약 기능을 활용한 긴 파일 처리
- 작업 단위 세션 관리

## Expected Outcomes
- 로컬 환경에서 프라이버시를 보장하면서 코딩 작업 수행
- API 비용 없이 무제한 사용 가능
- 인터넷 연결 없이도 동작하는 독립적인 시스템
- 다양한 로컬 모델 실험 및 비교 플랫폼

## Future Extensions
- RAG 기반 코드베이스 인덱싱
- 모델 앙상블을 통한 성능 향상
- 특화된 코딩 태스크별 파인튜닝
- 협업 기능 (멀티 에이전트 시스템)

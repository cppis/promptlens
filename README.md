# PromptLens

> AI가 내 말을 어떻게 이해했는지 보여주고, 부족한 맥락을 알아서 채워준다.

## 개요

PromptLens는 Claude Desktop과 Claude Code에서 MCP 도구로 동작하는 프롬프트 분석 시스템입니다. 대화 중 자연스럽게 "이 프롬프트를 분석해줘"라고 요청하면, 품질 점수·누락 요소·개선 제안을 즉시 받을 수 있습니다.

두 가지 분석 모드를 제공합니다:

- **local** (기본): 로컬 규칙 엔진으로 즉시 분석. API 키 불필요, 비용 0.
- **api**: Claude API 메타 분석으로 3색 리포트 생성. Referenced(이해한 것) / Inferred(추론한 것) / Missing(부재 정보)를 분류.

## 핵심 기능

**프롬프트 품질 분석** — 5축 점수(Clarity, Specificity, Context, Structure, Actionability)와 누락 요소 감지, 개선 제안, 보강된 프롬프트를 제공합니다.

**3색 해석 리포트** (API 모드) — Claude API를 통해 프롬프트를 AI 관점에서 분해합니다.
- Referenced (초록): AI가 명확히 이해한 용어
- Inferred (오렌지): AI가 추론한 배경 맥락 + 확신도
- Missing (빨강): AI가 모르는 부재 정보 + 보충 가이드

**프로젝트별 히스토리** — 분석 결과를 프로젝트 단위로 기록·관리합니다. 점수 추이, 태그, 노트를 추적합니다.

**Claude 대화 Import** — Claude Desktop(conversations.json)과 Claude Code(.jsonl)의 대화를 Import하여 기존 프롬프트를 분석·관리합니다.

## 설치

```bash
cd mcp-server
npm install
```

## Claude Desktop 설정

`claude_desktop_config.json`에 추가합니다:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "promptlens": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.js"]
    }
  }
}
```

설정 후 Claude Desktop을 재시작합니다.

## Claude Code 설정

```bash
claude mcp add promptlens node /absolute/path/to/mcp-server/index.js
```

## 제공 도구 (9개)

| 도구 | 설명 |
|------|------|
| `analyze_prompt` | 프롬프트 품질 분석 (mode: local/api) |
| `list_projects` | 모든 프로젝트 목록 + 통계 |
| `create_project` | 새 프로젝트 생성 |
| `get_history` | 프로젝트별 히스토리 조회 (검색·페이징) |
| `add_history_entry` | 프롬프트를 히스토리에 수동 추가 |
| `import_claude_conversations` | Claude Desktop/Code 대화 Import |
| `get_stats` | 전체 통계 (프로젝트 수, 평균 점수, 태그) |
| `set_api_key` | API 키 등록 + 유효성 검증 |
| `get_settings` | 현재 설정 확인 (API 키 상태, 모델) |

## 사용 예시

**프롬프트 분석 (로컬):**
> "React로 로그인 폼 만들어줘"라는 프롬프트를 분석해줘

→ Score: 43/100 (D). Missing: Role, Context, Output Format, Example.

**프롬프트 분석 (API — 3색 리포트):**
> 이 프롬프트를 API 모드로 분석해줘: "React로 로그인 폼 만들어줘"

→ Referenced: React(JS UI 라이브러리), 로그인 폼(인증 UI). Inferred: 웹 앱(high), 함수형 컴포넌트(medium). Missing: 인증 방식, 스타일링, 상태 관리.

**API 키 등록:**
> PromptLens에 API 키 등록해줘: sk-ant-api03-...

→ 키 유효성 검증 후 저장. 이후 analyze_prompt에서 mode: "api" 사용 가능.

**대화 Import:**
> ~/Downloads/conversations.json을 PromptLens에 Import해줘

→ 377개 대화에서 1,234개 프롬프트를 Import.

## 아키텍처

```
[Claude Desktop / Claude Code]
    │
    ├── MCP 도구 호출 (stdio)
    │
    ▼
[PromptLens MCP Server]
    ├── analyze_prompt (local) → 로컬 규칙 엔진 (즉시, 무료)
    ├── analyze_prompt (api)   → Claude API 메타 분석 (3색 리포트, BYOK)
    ├── 프로젝트·히스토리 CRUD → ~/.promptlens/data.json
    ├── 설정·API 키            → ~/.promptlens/settings.json
    └── Claude 대화 Import     → conversations.json / .jsonl 파서
```

## 기술 스택

| 계층 | 기술 |
|------|------|
| 런타임 | Node.js (ES Modules) |
| MCP SDK | @modelcontextprotocol/sdk (stdio transport) |
| 스키마 검증 | Zod |
| 분석 엔진 | 로컬 규칙 엔진 (5축 패턴 매칭) + Claude API (3색 분류) |
| AI | Anthropic Claude API (BYOK — Sonnet / Haiku / Opus) |
| 저장소 | 파일 기반 JSON (~/.promptlens/) |

## 프로젝트 구조

```
mcp-server/
├── index.js                 ← MCP Server 엔트리 (9개 도구 등록)
├── lib/
│   ├── analyzer.js          ← 분석 엔진 (local + api 두 모드)
│   ├── storage.js           ← 파일 기반 저장소 + 설정 관리
│   └── importer.js          ← Claude Desktop/Code 대화 Import
├── package.json
└── node_modules/

prototype/                   ← 이전 프로토타입 (참고용, 향후 제거 예정)
├── chrome-extension/        ← v0.1 크롬 확장 프로토타입
└── visualization/           ← v0.2 Svelte + D3.js + ECharts 시각화
```

## 문서

| 문서 | 내용 |
|------|------|
| `docs/0.overview.md` | 프롬프트 분석 메커니즘 (3색 분류, Context 획득, MCP 분석 흐름) |
| `docs/1.add.md` | 제품 설계 + 시장 조사 (기능 메카닉, 경쟁 분석, 포지셔닝) |
| `docs/2.plan.md` | 개발 계획 (MCP 아키텍처, 코어 패키지 구조, 검증 지표) |
| `docs/3.usage.md` | 사용 가이드 (설치, 설정, 기능별 사용법, FAQ) |

## FAQ

**Q: API 키 없이도 사용할 수 있나요?**

네. 기본 `local` 모드는 API 키 없이 즉시 분석 가능합니다. API 키를 등록하면 추가로 `api` 모드(3색 리포트)를 사용할 수 있습니다.

**Q: 크롬 확장은 어떻게 되나요?**

`prototype/` 디렉토리에 참고용으로 유지됩니다. MCP Server가 유일한 공식 클라이언트이며, 시각화가 필요하면 Claude에게 분석 결과를 차트나 표로 정리해달라고 요청하면 됩니다.

**Q: 데이터는 어디에 저장되나요?**

`~/.promptlens/data.json` (프로젝트·히스토리)과 `~/.promptlens/settings.json` (API 키·모델 설정). 모두 로컬 파일이며 외부로 전송되지 않습니다.

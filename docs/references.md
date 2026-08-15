# 참고 자료 — 오픈소스 조사

> 출처: ClickUp 팀 문서 `정리해본거`, `참고 사이트`
> 조사 시점 기준 정보다. 버전·저장소 위치는 사용 전 최신 상태를 확인할 것.

제품 구조(`자연어/직접조작 → Command Engine → IR Store → Canvas Renderer → Ticket Compiler → Claude Code`)에 대응시켜 정리했다.

## 결론 먼저

**하나를 fork하기보다, craft.js(캔버스 엔진) + openpencil의 IR/MCP 설계를 참고해 IR 스펙을 직접 짜는 것을 권한다.** 기존 프로젝트들은 각자의 목적(디자인 툴, 원클릭 앱 빌더)에 최적화돼 있어 "자연어 ↔ GUI 완전 대칭, 캔버스-코드 단계 분리"라는 요구와 정확히 맞는 것이 없다.

| 목적 | 1순위 참고 | 이유 |
|---|---|---|
| IR 설계, Command Engine 개념 | openpencil (ZSeven-W), craft.js | `.op` JSON IR과 단계적 생성 흐름이 가장 유사 / craft.js는 코드 재사용 가능 |
| 캔버스 렌더러 뼈대 (React) | craft.js (유연성) 또는 Puck (속도) | 노드 트리 + 드래그앤드롭을 직접 만들 필요 없음 |
| 코드 ↔ 캔버스 매핑 | onlook | DOM-코드 계측 방식 |
| 기존 프로젝트 import (HTML/CSS → IR) | open-pencil `dom-css` | HTML/CSS/Tailwind를 편집 가능한 노드로 변환 |
| Claude Code 연결 (MCP) | MCP TypeScript SDK + openpencil `pen-mcp` | 표준 SDK + 실전 구현 예시 |
| Undo/Redo, 변경 이력 UX | bolt.diy, dyad | 체크포인트/되돌리기 UI 패턴 |

---

## 그룹 1. 아키텍처가 거의 일치하는 프로젝트

### 🟢 [ZSeven-W/openpencil](https://github.com/ZSeven-W/openpencil) — IR + 자연어 커맨드 + MCP 구조가 가장 유사

- `.op` 파일이 사람이 읽을 수 있는 JSON IR. Git-friendly, diffable
- 자연어 → `design_skeleton → design_content → design_refine` 단계적 생성. "계획 후 생성" 흐름과 일치
- 캔버스 조작과 AI 조작이 동일한 내부 명령으로 귀결되는 구조 = Command Engine에 해당
- 내장 MCP 서버 `pen-mcp` — Claude Code가 `.op`를 직접 읽고 씀. Ticket Compiler → Claude Code 연결부에 응용 가능
- 코드 export: React+Tailwind, Vue, Svelte, Flutter
- 패키지 구조 참고 가치: `pen-types`(IR 타입), `pen-core`(트리 연산/레이아웃), `pen-engine`(headless), `pen-react`, `pen-codegen`
- 스택: React 19, TanStack Start, CanvasKit/Skia, Zustand, Electron, Bun. MIT

### 🟢 [onlook-dev/onlook](https://github.com/onlook-dev/onlook) — 캔버스 = 코드 철학의 실제 구현

- 자연어 → 코드 생성 → WebContainer 실행 → iframe 프리뷰 → DOM 요소 클릭 시 실제 코드 위치와 매핑 → 직접 조작 시 코드에 즉시 반영
- 참고할 점: **element ↔ code mapping 계측 방식**
- 다만 별도 IR 없이 **DOM 자체가 IR** 역할이다. 독립 JSON IR을 코드와 분리해 관리하려는 이 제품과는 구조가 다르다
- 스택: Next.js, tRPC, Supabase/Drizzle, CodeSandbox SDK, AI SDK. Apache-2.0

### 🟡 [open-pencil/open-pencil](https://github.com/open-pencil/open-pencil) — Figma 호환 벡터 엔진 (별개 팀)

- `.fig`/`.pen` 파일 열기, **XPath로 IR 쿼리** (`//FRAME[@width < 300]`) — 자연어 범위 지정 방식에 참고 가치
- `dom-css` 패키지: **HTML/CSS/Tailwind → 편집 가능한 IR 노드로 역변환**
- Skia/CanvasKit 렌더링, Yoga 기반 오토 레이아웃, 100여 개 MCP 도구
- Vue 기반이라 직접 이식은 어렵지만 CLI/MCP 설계와 XPath 질의 방식은 언어 무관하게 참고 가능. MIT

---

## 그룹 2. 캔버스 / 드래그앤드롭 엔진 — 직접 재사용 가능

### 🟢 [prevwong/craft.js](https://github.com/prevwong/craft.js) — Command Engine 하부 구현체 1순위

- 완제품 에디터가 아니라 **에디터를 만들기 위한 프레임워크**. UI 없이 노드 트리, 드래그앤드롭, 선택/이동 로직만 제공
- `createNode / appendChild / moveNode` 명령이 craft.js의 `actions.add`, `actions.move`와 개념적으로 거의 동일
- `query.serialize()`로 에디터 상태를 JSON으로 직렬화 — IR 스키마와 연결하기 좋다
- 기본 history plugin 제공 (Undo/Redo 요구사항과 맞음)
- 단점: 완제품 UI가 없어 트리 패널·속성 패널·레이아웃 컨트롤은 직접 만들어야 함

### 🟡 [puckeditor/puck](https://github.com/puckeditor/puck) — 완제품에 가까운 React 비주얼 에디터

- `config.components`에 등록하면 드래그앤드롭 페이지 빌더가 바로 동작
- JSON 데이터 모델(`data`)을 그대로 저장/전송 가능 — IR과 유사한 역할
- craft.js보다 UI 완성도가 높지만, 자유로운 레이아웃(Row/Column 임의 중첩, 반응형 columns) 커스터마이징은 craft.js가 더 유연
- **빠른 MVP가 목적이면 Puck, 세밀한 IR 설계가 목적이면 craft.js.** MIT

---

## 그룹 3. 디자인 툴 / MCP 연동 (선택적, 무거움)

### 🟡 [penpot/penpot](https://github.com/penpot/penpot)

- 풀스펙 Figma 대체 디자인 툴. 자체 서버 필요, MPL-2.0. "가벼운 localhost 캔버스 스튜디오"보다 훨씬 무겁다
- `penpot-mcp`는 메인 저장소(`penpot/penpot/tree/develop/mcp`)로 통합되어 별도 저장소는 archived 상태다. 참고 시 최신 위치 확인 필요
- 참고 가치: **Plugin API 기반으로 LLM이 디자인 요소를 CRUD하는 MCP 도구 설계 패턴**
- 목적이 다르므로(디자이너용 Figma 대체) 기반으로 쓰기엔 부적합. Figma import 같은 확장 기능 검토 시에나 대상

---

## 그룹 4. 자연어 → 코드 에이전트형 (UX 패턴 참고용)

이 그룹은 이 제품이 명시적으로 피하는 방식(자연어 → 바로 코드 수정)이지만, UX 패턴은 참고 가치가 있다.

- **[stackblitz-labs/bolt.diy](https://github.com/stackblitz-labs/bolt.diy)** — WebContainer로 풀스택 앱 실행, diff 뷰·revert. Undo/Redo 및 변경 이력 UI 참고.
  ⚠️ 소스는 MIT이지만 **WebContainers API는 상업적 사용 시 별도 라이선스 조건**이 적용된다
- **[dyad-sh/dyad](https://github.com/dyad-sh/dyad)** — 로컬 Electron 앱. 코드베이스 import 시 `AI_RULES.md`를 자동 생성해 AI가 컨벤션을 따르게 함. 세션·프로젝트·파일 변경 구조 참고.
  ⚠️ Apache-2.0이지만 `src/pro`에는 별도 라이선스 적용
- **[firecrawl/open-lovable](https://github.com/firecrawl/open-lovable)** — URL → 스크래핑 → AI가 React로 재구성, E2B 샌드박스 실행. "기존 화면 불러오기"를 URL 기반으로 구현할 때 참고

---

## 그룹 5. 인프라 — MCP 서버

### [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)

Claude Code와 Codex가 Studio를 직접 제어하게 하려면 이 SDK로 로컬 MCP 서버를 만드는 것이 표준 경로다.

노출할 도구 예시:

```
get_project_info      get_component_catalog   get_canvas_state
get_selected_nodes    update_node_props       insert_component
move_node             delete_node             save_spec
request_code_patch    get_preview_screenshot
```

⚠️ **v2는 프리알파/베타 단계이며 `@modelcontextprotocol/sdk`가 `@modelcontextprotocol/server` / `@modelcontextprotocol/client`로 분리될 예정이다. 지금 시작한다면 안정판 v1(`@modelcontextprotocol/sdk`)로 출발하고 마이그레이션 경로를 열어두는 편이 낫다.**

openpencil의 `pen-mcp`가 이 SDK로 100여 개 도구를 어떻게 설계했는지 코드 레벨로 보는 것이 가장 실전적인 학습 자료다.

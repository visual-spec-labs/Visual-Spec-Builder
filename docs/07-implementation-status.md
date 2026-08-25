# 07. 구현 현황

> 확인 기준일: **2026-08-20** / 확인 대상 브랜치: `Yumesa2025/roadmap`
> 부분 갱신: **2026-08-25** / 확인 대상: `Yumesa2025/validate-skill-refresh` (`develop` 78a3e72 기준)
>
> 2026-08-25 갱신은 **문서 전체 재검증이 아니다.** 이번에 실제로 돌려 확인한 것은
> `pnpm install --frozen-lockfile` · `pnpm run typecheck` · `pnpm test` 세 명령의 결과(4절 테스트 행,
> 1절 IR·스키마 행, 아래 "확인 방법")와 5.2에 적힌 `describeSchemaError()` 의 실제 메시지 문구뿐이다.
> **나머지 항목은 2026-08-20 확인 상태 그대로이며 이번에 재확인하지 않았다.**
>
> 이 문서는 **저장소의 실제 상태를 반영하는 현황 보고**다. 계획서가 아니다.
> 코드가 바뀌면 이 문서도 함께 갱신한다. 갱신하지 않은 채 방치하면 없느니만 못하다.
>
> 범위 정의는 이 문서가 하지 않는다. **무엇을 만들기로 했는지는 [02-mvp-scope.md](02-mvp-scope.md)가 기준이다.**
> 여기서는 그 문서가 정한 항목들이 지금 어떤 상태인지만 덧붙인다.

## 상태 표기

| 표기 | 의미 |
|---|---|
| **완료** | 해당 범위가 구현됐고 테스트 또는 예제로 확인된다 |
| **부분** | 일부만 동작한다. 무엇이 되고 무엇이 안 되는지 항상 함께 적는다 |
| **미착수** | 관련 코드가 저장소에 없다 |

퍼센트는 쓰지 않는다. 근거가 되는 파일 경로를 함께 적어 읽는 사람이 직접 확인할 수 있게 한다.

---

## 1. MVP 구현 단위 6개

[02-mvp-scope.md의 "구현 단위" 표](02-mvp-scope.md#구현-단위)에 대응한다.

| 단위 | 상태 | 근거 / 무엇이 되고 무엇이 안 되는가 |
|---|---|---|
| IR · 스키마 | **완료** | `src/features/editor/schema/` — JSON Schema 정본, 생성 타입, 검증기, 공개 index. v0.1로 동결([06-schema-freeze.md](06-schema-freeze.md)). `test/` 4파일 34케이스 통과 |
| Command Engine | **미착수** | `command.schema.ts` 없음, history manager 없음. `src/` 전체에 Command 관련 코드 0줄 |
| 자연어 변환 | **미착수** | 관련 코드 없음 |
| Ticket Compiler · Agent | **부분** | 코드 생성만 `skills/visual-spec-to-react/SKILL.md`가 에이전트 지시문 형태로 대신한다. IR을 작업 단위로 쪼개는 **티켓 개념, 실행 순서 결정, 티켓 상태 관리는 없다**. 티켓 스키마도 없다 |
| localhost GUI · Canvas | **부분(골격만)** | `src/features/editor/ui/` 에 5개 영역이 CSS Grid로 배치돼 있다. **전부 정적 플레이스홀더다** — 상태도 클릭 핸들러도 없고 스키마와 연결돼 있지 않다. 캔버스에 화면을 그려볼 수 없다 |
| Export · 검증 | **미착수** | Export 관련 코드 없음. (단, 스펙 문서 검증기 `validateVisualSpec`은 별개로 존재하며 위 IR·스키마 항목에 포함된다) |

### GUI 골격의 실제 내용

| 파일 | 내용 | 동작 |
|---|---|---|
| `src/features/editor/ui/EditorLayout.tsx` | 5개 영역 CSS Grid 배치 | 배치만 |
| `src/features/editor/ui/MenuBar.tsx` | `File` / `View` 를 `<span>` 으로 표시 | 클릭 불가 |
| `src/features/editor/ui/LayerTree.tsx` | "레이어 트리" 문구 | 노드 목록 없음 |
| `src/features/editor/ui/Canvas.tsx` | "캔버스" 문구 | 렌더링 없음 |
| `src/features/editor/ui/PropertiesPanel.tsx` | "세부설정 패널" 문구 | 편집 불가 |
| `src/features/editor/ui/Toolbar.tsx` | `Select` / `Frame` / `Text` / `Hand` 를 `<span>` 으로 표시 | 도구 전환 없음 |
| `src/app/App.tsx` | `EditorLayout` 을 그대로 렌더 | 라우팅 없음 |

각 파일 상단 주석에도 "지금은 자리만 잡는다"고 명시돼 있다.

---

## 2. MVP 문서가 요구하는데 저장소에 없는 것

| 항목 | 02-mvp-scope.md의 요구 | 상태 | 근거 |
|---|---|---|---|
| CLI | `npx visual-spec init` / `npx visual-spec` | **미착수** | `package.json` 에 `bin` 필드 없음. CLI 진입점 파일 없음 |
| `.visual-spec/` 작업공간 | `specs/` `generated/` `preview/` `assets/` `runtime/` | **미착수** | 작업공간을 만들거나 읽는 코드 0줄 |
| Command 스키마 v0.1 | "v0.1로 고정한다"고 선언한 3개 스키마 중 하나 | **미착수** | 스키마 파일 없음 |
| Ticket 스키마 v0.1 | 같음 | **미착수** | 스키마 파일 없음 |
| Undo / Redo | MVP 포함 범위 표 "편집" 행 | **미착수** | history manager 없음 (Command Engine 부재의 결과) |
| 반응형 (데스크톱 · 모바일) | MVP 포함 범위 표 "반응형" 행 | **미착수** | 스키마가 `responsive`를 명시적으로 제외([06-schema-freeze.md](06-schema-freeze.md), [05-schema.md](05-schema.md)) |
| 홈(진입) 화면 | [04-gui-spec.md §2](04-gui-spec.md#2-홈진입-화면)가 화면 목록·카드·빈 상태까지 명세 | **미착수** | `src/app/App.tsx` 가 `EditorLayout` 을 바로 렌더한다. 홈 화면 컴포넌트도 라우팅도 없다 |

세 스키마 중 IR 스키마 하나만 v0.1로 고정됐고, Command·Ticket 두 개는 아직 문서상의 선언으로만 존재한다.

---

## 3. 02-mvp-scope.md와 스키마 v0.1의 범위 차이

02가 요구하는 범위와 실제 동결된 스키마 v0.1의 범위가 일치하지 않는 항목이 있다.
**일부는 [06-schema-freeze.md](06-schema-freeze.md)가 의도적으로 좁힌 것이고, 일부는 어느 문서도 정리하지 않은 미조정 항목이다.** 둘을 구분해서 읽어야 한다.

### 노드 타입

02는 `Container / Text / Button / Input / Image` 5종을 요구한다. 스키마 v0.1은 `frame`, `text` 2종뿐이다(`src/features/editor/schema/visual-spec.schema.json` 의 `$defs.Node`).

| 02가 요구한 노드 | v0.1 | 성격 |
|---|---|---|
| Container | `frame` 으로 충족 | 이름만 다르다 |
| Text | `text` 로 충족 | — |
| Image | 없음 | **의도적 제외.** 06이 `image`를 "지원하지 않는다"로, 05가 `ImageNode`를 MVP 제외 범위로 명시했다 |
| Button | 없음 | **미조정.** 05·06 어느 쪽의 제외 목록에도 없다. 요구되지만 구현도 제외 선언도 되지 않았다 |
| Input | 없음 | **미조정.** 같음 |

### 레이아웃

02는 `Row / Column / Grid` 를 요구한다. 정본 스키마의 `$defs.Layout.direction` 은 `["row", "column"]` 두 값만 허용한다.

- Row · Column — 충족
- **Grid — 없다.** 05·06의 제외 목록 어디에도 Grid가 없다. 노드 타입의 Button·Input과 같은 미조정 항목이다.

### 크기

02의 `Fixed / Fill / Hug` 는 v0.1의 `Size = number | "fill" | "auto"` 로 전부 충족된다.
다만 06이 밝힌 대로 **`"fill"` 이 교차축에서 무엇을 의미하는지는 계약에 포함되지 않았다.** Renderer 구현 시점에 정해야 한다.

> Button · Input · Grid 3건은 "구현이 안 됐다"기보다 **02와 05·06 사이가 정리되지 않은 상태**다.
> 스키마를 넓힐지 02의 범위를 줄일지는 팀이 정할 일이며, 스키마를 건드린다면 [06-schema-freeze.md](06-schema-freeze.md)의 변경 절차를 따라야 한다.

---

## 4. 있는 것 — 스키마와 그 주변

이 영역은 확실히 완료된 부분이다.

| 항목 | 경로 | 비고 |
|---|---|---|
| JSON Schema 정본 | `src/features/editor/schema/visual-spec.schema.json` | 유일한 정본 |
| 생성 타입 | `src/features/editor/schema/types.ts` | 손으로 고치지 않는 생성 파일 |
| 검증기 | `src/features/editor/schema/validate.ts` | `validateVisualSpec` / `assertVisualSpec` / `VisualSpecValidationError` |
| 공개 표면 | `src/features/editor/schema/index.ts` | 타입·검증기는 이 index를 거쳐서만 가져온다 |
| 타입 생성 스크립트 | `scripts/generate-types.mjs` | `pnpm run generate:types` |
| 유효 예제 4개 | `examples/*.json` | 검증 통과 |
| 무효 예제 8개 | `examples/invalid/*.json` | 검증기가 잡아야 하는 문서들 |
| 테스트 | `test/schema.test.ts`(4) · `test/public-api.test.ts`(4) · `test/validate.test.ts`(18) · `test/editor-store.test.ts`(8) | **4파일 34케이스 전부 통과** (2026-08-25 확인) |
| CI | `.github/workflows/ci.yml` | 타입체크 · 테스트 · 스키마 드리프트 검사 |
| 스킬 6종 | `skills/` — `visual-spec`(허브) · `visual-spec-docs` · `visual-spec-authoring` · `visual-spec-validate` · `visual-spec-to-react` · `analyze-target-project` | 배포 원본은 저장소 루트 `skills/`. 사람이 읽는 설명은 `docs/skills/` 에 같은 이름으로 6개 |

검증기가 잡아내는 구조 오류는 코드 7종이다 — `schema`, `root-missing`, `root-not-frame`, `child-missing`, `cycle`, `multiple-parents`, `orphan-node`.

---

## 5. 확인된 결함과 개선 여지

### 5.1 `package.json` 의 `main` 이 없는 파일을 가리킨다

```json
"main": "src/index.ts"
```

`src/index.ts` 는 저장소에 존재하지 않는다. 스키마를 `src/features/editor/schema/` 로 옮기면서 파일은 사라졌는데 필드가 남았다.

`private: true` 인 Vite 앱이라 지금 당장 깨지는 것은 없다. 다만 **끊긴 참조**이고, 나중에 이 패키지를 실제로 배포하거나 `bin` 을 추가할 때 문제가 된다.
(이 문서는 관찰 기록이므로 수정하지 않았다.)

### 5.2 검증기의 `schema` 이슈에 정보가 없었다 — **해결됨 (2026-08-21)**

`src/features/editor/schema/validate.ts` 의 `validateVisualSpec` 이 ajv 오류의 `error.keyword`,
`error.params` 를 버리고 모든 `schema` 이슈에 "JSON 스키마의 구조 규칙을 위반했습니다."라는
상수 문구 하나만 붙이던 문제다. `examples/invalid/text-without-content.json` 을 검증하면
이슈 7개가 나오는데, 정작 원인인 `"content" 가 없다`는 말은 한 번도 나오지 않았다.

`describeSchemaError()` 를 추가해 `error.keyword` 로 분기, `required` → `필수 필드 "X"가
없습니다.`, `additionalProperties` → `허용되지 않는 필드 "X"가 있습니다.` 처럼 위반 종류별
메시지를 만든다. 스키마에 실제 쓰이는 키워드
(`required`, `additionalProperties`, `const`, `enum`, `type`, `pattern`, `propertyNames`,
`minimum`/`exclusiveMinimum`/`maximum`/`exclusiveMaximum`, `minLength`, `minProperties`,
`multipleOf`, `oneOf`) 14개를 전부 다루고, 각 키워드의 `params` 필드명은 실제 ajv 출력으로
검증했다. `ValidationIssue` 의 타입(`code`/`path`/`message`)은 바꾸지 않았다 — 공개 표면을
넓히지 않고 `message` 문구만 고쳤다.

`validateVisualSpec` 이 절대 예외를 던지지 않는다는 계약([06-schema-freeze.md](06-schema-freeze.md))은
계속 지켜진다.

---

## 6. 다음에 할 만한 것 (제안)

**아래는 확정된 계획이 아니라 제안이다.** 일정·담당자·우선순위는 팀이 정한다.
여기 적는 것은 "무엇을 먼저 하면 뒤 작업이 쉬워지는가"에 대한 근거뿐이다.

### 제안 1 — 캔버스 렌더링을 Command Engine보다 먼저

현재 Command Engine이 가장 큰 빈칸이고, [02-mvp-scope.md](02-mvp-scope.md)가 "GUI는 IR을 직접 수정하지 않고 Command Engine을 호출한다"를 핵심 제약으로 못박았다. 그래서 Command Engine부터 손대고 싶어지는데, **먼저 캔버스가 IR을 읽어 그리게 만드는 편이 낫다고 본다.**

근거는 이렇다.

- 지금 캔버스는 스키마와 아예 연결돼 있지 않다. **읽기(IR → 화면)가 되기 전에는 쓰기(커맨드 → IR)가 맞게 동작하는지 확인할 방법이 없다.** 커맨드를 만들어도 결과를 눈으로 볼 수 없다.
- 어떤 커맨드가 실제로 필요한지는 화면을 만져 봐야 안다. 상상만으로 `command.schema.ts` 를 먼저 쓰면 v0.1로 고정한 뒤 다시 뜯게 될 가능성이 크다. IR 스키마는 예제 4개를 먼저 만들어 검증한 뒤 동결했다 — 같은 순서를 따르는 것이다.
- 렌더러를 구현하면 06이 "보장하지 않는다"고 남겨 둔 **`"fill"` 의 교차축 의미**를 정할 근거가 생긴다. 06 자체가 "Renderer 구현 시점에 정한다"고 적어 두었다.
- 읽기 전용이라 IR 불변조건을 깨뜨릴 위험이 없다. `examples/*.json` 4개가 그대로 회귀 테스트 입력이 된다.

### 제안 2 — 검증기 메시지 개선은 언제든 가능하다 (완료, 5.2 참고)

5.2가 처리됐다. 스키마 **구조**를 바꾸지 않고 `validate.ts` 안에서만 고쳤다 —
[06-schema-freeze.md](06-schema-freeze.md)의 동결 대상은 스키마의 구조와 제약이지 검증기의
메시지 문구가 아니므로 동결 해제를 기다리지 않았다. `ValidationIssue` 에 필드를 추가하지
않아 공개 표면도 넓어지지 않았다.

### 제안 3 — Button · Input · Grid는 코드보다 문서 결정이 먼저

3절의 미조정 3건은 구현 과제가 아니라 **범위 결정 과제**다. 스키마를 넓힐지 02의 범위를 줄일지 정하지 않은 채로 구현에 들어가면 [06-schema-freeze.md](06-schema-freeze.md)의 변경 절차를 우회하게 된다. 결정 결과는 02 또는 05·06에 반영하고, 미확정으로 남는다면 [open-questions.md](open-questions.md)로 옮기는 편이 낫다.

---

## 확인 방법

이 문서의 주장은 아래를 실행해 재확인할 수 있다.

```bash
pnpm install --frozen-lockfile
pnpm run typecheck   # 통과 (2026-08-25 확인)
pnpm test            # 4파일 34케이스 통과 (2026-08-25 확인)
```

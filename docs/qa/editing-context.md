# 선택·반응형 편집 범위 QA — #289 첫 단계

2026-10-09, develop `44370d4f6151f2e351f41ebc5f000eb669a9b735`에서 분기했다.
Related #289. 전체 이슈 완료가 아니다.

## 범위와 실제 계약

초기 파일 계획은 `PropertiesPanel.tsx`, `ResponsivePanel.tsx`, 관련 브라우저 회귀와 이 기록이다.
CONTRIBUTING, EDITOR_STORE_CONTRACT, 디자인 토큰 규칙과 실제 `useNodeField` /
`useResponsiveScreen` / `resolveResponsiveScreen` 구현을 대조했다.

스토어·IR·Command·저장 수명주기는 바꾸지 않는다. 다음은 기존 동작의 표시다.

| 상태 | 지속 표시 및 편집 대상 |
|---|---|
| 선택 없음 + 기본값 | 페이지 이름·크기; 노드를 자동으로 선택하지 않는다 |
| 노드 선택 + 기본값 | 선택한 노드 1개의 기반 속성 |
| 루트 선택 + 기본값 | 페이지 이름·크기와 루트 프레임 1개의 속성 |
| 분기점 + 선택 없음 | 현재 분기점/폭과 노드 선택 안내; 페이지 속성은 숨김 |
| 분기점 + 노드/루트 | 해당 노드의 현재 분기점 재정의; 이름·내용·그림자는 기반 전용 |
| Undo 또는 페이지 전환 | 기존 계약에 따라 선택 해제; 새 선택 범위를 즉시 표시 |

기본값(base) → 최소 폭 오름차순 분기점(breakpoint) → 재정의(override)를 누적한다.
미리보기 폭에서 활성화되는 마지막 분기점이 편집 기준이다. 편집 기준 선택도 미리보기 폭을 바꾼다.
따라서 폭은 단순한 관찰 옵션만이 아니다. 폭 변경 자체는 페이지 크기·문서·Undo 이력을 바꾸지 않는다.
현재 기준보다 큰 폭은 값을 상속하지만 같은 속성의 자체 재정의가 있으면 그 값이 우선한다.
페이지 이름·크기는 기본값으로 돌아간 뒤 선택 해제 또는 루트 선택으로 편집한다.

## 표시와 키보드

기존 패널·색상 토큰을 그대로 쓰며, 섹션 순서나 전역 디자인을 바꾸지 않는다.

```text
노드 이름 / 한글 타입 / 표시 토글
──────────────────────────────
페이지: 현재 페이지
선택: 없음 | 노드 1개 | 루트 프레임 1개
편집: 기본값(base) | 분기점 재정의(override) ← 여기까지 role=status
미리보기 Npx / 현재 편집 대상 설명  ← 스크롤 밖, live region 밖
──────────────────────────────
반응형 기준 / 미리보기 폭           ← aria-describedby로 폭-기준 연결 설명
▸ 편집 범위와 상속 안내             ← 기본 접힘, native details/summary
분기점 관리 / 선택 노드 재정의
페이지 및 노드 속성                 ← 기존 스크롤 영역
```

- 선택·편집 안내는 색상만으로 구분하지 않는다. 기본값·분기점·재정의는 한글을 먼저 쓰고
  연결해야 할 영어 계약명을 병기한다. 이 첫 단계에서는 개별 속성 섹션 전체 번역은 하지 않는다.
- Tab/Shift+Tab은 native 입력·select·button·summary 순서를 따른다. select의 Home/방향키와
  Enter, summary의 Enter, 재정의 해제 버튼의 Enter를 실제 Chromium에서 확인했다.
- 분기점 삭제(그 분기점의 모든 노드), 노드 재정의 삭제(선택 노드만), 속성 상속(해당 경로만),
  현재 표현값 고정의 범위를 title로 설명한다. 핵심 편집 제한은 title에만 숨기지 않고 안내에 적는다.
- 이 영역의 입력·버튼·안내 펼침 및 헤더 버튼/이름에 `content` 색 2px 키보드 포커스를 사용한다.
  오류는 `role=alert`와 오류색 왼쪽 선, 대비가 높은 본문색으로 표시한다.
- 오류/안내 글자는 기존 10px에서 12px로 조정했다. 버튼 행은 최소 패널 폭에서 줄바꿈한다.

## 재현 가능한 실제 브라우저 회귀

Python Playwright와 Chromium이 필요하다. pnpm 의존성에는 추가하지 않았다.
타입 생성 등 파일을 갱신하는 검사를 끝낸 뒤 **새 Vite 서버**를 시작한다.
테스트는 dev 모듈로 지정 fixture를 로드한다. HMR 중의 모듈 교체와 병행 실행하지 않는다.

```bash
pnpm install --frozen-lockfile
VISUAL_SPEC_WORKSPACE="$(mktemp -d)" pnpm dev --host 127.0.0.1 --port 5173
# 별도 터미널
python scripts/browser/editing-context.py http://127.0.0.1:5173
```

`CHROME_BIN`으로 Chromium 경로, `VSB_QA_ARTIFACTS`로 출력 폴더를 바꿀 수 있다.
기본 출력은 OS 임시 폴더 아래 `vsb-289-qa/{result.json,light.png,dark.png}`다.
Chromium은 `CHROME_BIN` → PATH의 `chromium` → Playwright 설치본 순으로 찾는다.
PATH에 없으면 `python -m playwright install chromium`으로 설치하거나 `CHROME_BIN`을 지정한다.
fixture와 결과 파일의 인코딩은 UTF-8로 고정하고 콘솔 JSON은 ASCII escape로 출력한다.
`examples/responsive-cards.json`을 직접 로드하는 수동 fixture 기반 실측이며 실제 AI 생성이나
파일 Open/저장/초안 복구 검증이 아니다. 새 브라우저 컨텍스트와 임시 작업공간을 사용한다.

Chromium **151.0.7922.173**, viewport 1280×900, 속성 패널 최소 폭 280px에서 통과:

- 767/768/1023/1024px 경계와 편집 기준, 기준 선택 시 폭 변경, 문서·history 불변.
- 미선택·단일 노드·루트·페이지 전환의 표시와 페이지 속성 노출 조건.
- tablet에서 간격 19 편집 → 기반값 8 보존, 재정의 19 → Enter로 상속 복원 → Undo로 19 복구.
  Undo 뒤 선택이 풀리는 기존 동작도 검증한다.
- 무효 분기점 ID: alert, 문서·history 불변.
- Tab 이동·Enter로 안내 펼침, 입력과 설명 연결, 포커스 2px 표시.
- 패널 스크롤 후 고정 상태 위치 유지, 가로 넘침 없음, light/dark 스크린샷 육안 확인.
- 브라우저 pageerror 0건.

| 실측 대비 | Light | Dark |
|---|---:|---:|
| 안내 / 패널 배경 | 7.81:1 | 6.43:1 |
| 오류 본문 / 패널 배경 | 15.13:1 | 11.31:1 |
| 입력 포커스 / 패널 배경 | 15.13:1 | 11.31:1 |

스크린리더 음성 출력·다른 브라우저·전체 앱 접근성 감사는 수행하지 않았다.

## 로컬 검사와 후속 경계

pnpm 10.33.0으로 typecheck, lint, 전체 테스트 **110개 파일 / 1781개 테스트 통과**,
build, generate:types 후 스키마 diff 없음, git diff --check를 확인했다.
기존 opt-in 코드 생성 브라우저 테스트 3개는 전체 suite 기본 설정대로 제외되며, 이 변경의
실제 GUI 회귀는 위 별도 스크립트로 실행했다. 초기 tarball smoke는 writable pnpm data 경로가
없어 실패했고 `XDG_DATA_HOME`을 `/tmp` 아래로 지정한 전체 재실행에서 통과했다.
기존 build의 500kB chunk 안내는 남아 있다.

후속 단계: #302 전환 모달과 #319 Home 초안 복구의 Save/Cancel/Discard 계약이 확정된 뒤
저장됨·수정됨·초안 보관·충돌의 지속 표시를 통합한다. App/PromptDialog/HomeScreen/
specAutosave 및 저장소 수명주기 파일은 수정하지 않았다. 개별 속성 라벨·오류/빈 상태 전체의
용어 감사와 B09/B10 전체 접근성 완료도 주장하지 않는다. #280/#282/#290/#281/#284 및
전역 디자인 재설계는 이 PR 범위 밖이다. UI 메타데이터를 IR/Command schema에 추가하지 않았다.


## PR #340 리뷰 반영 (2026-10-09)

- Python의 fixture 읽기와 결과 파일 쓰기를 UTF-8로 고정했다. 임시 경로는
  `tempfile.gettempdir()`를 사용하며 Linux 전용 Chromium 경로를 제거했다. docstring도 한글로 바꿨다.
- 미리보기 폭과 일반 도움말은 live region 밖에 표시한다. 페이지·선택·편집 기준은 계속
  `role=status`로 알린다. 같은 분기점 내 1024→1100px 입력에서 MutationObserver로
  live region 변경 0건을 확인했다. 경계를 넘겨 편집 기준 자체가 바뀌면 알림 대상이다.
- 오류에 `오류:` 접두어를 붙여 테두리 색 없이도 식별할 수 있게 했다.
- `test/editing-context-render.test.ts`는 실제 PropertiesPanel과 그 안의 ResponsivePanel을
  렌더링한다. 미선택/노드/루트 × base/분기점 6개 조합, live region, 오류 총 8개 회귀가
  opt-in 없이 기존 `pnpm test`에 포함된다. SSR에서는 현재 fixture를 읽도록 Zustand 구독 훅만
  대체하며 실제 컴포넌트·반응형 계산·store 액션은 사용한다. 이벤트/구독/키보드는 실제 브라우저
  스크립트가 맡는다. RTL·DOM emulator 의존성을 추가하는 대신 기존 node 테스트 환경과
  React 서버 렌더러를 사용했다. Vitest JSX 변환 및 UI 테스트 타입 분류만 맞췄으며 CI workflow는
  수정하지 않아 #336의 workflow 작업과 겹치지 않는다.
- Python 스크립트는 유지한다. 위 이식성 수정으로 Node 재작성 없이 기존 회귀를 재사용한다.
  Linux Chromium에서 `PYTHONUTF8=0 PYTHONIOENCODING=cp949` 실행이 통과했으며 파일은 UTF-8,
  콘솔은 ASCII escape임을 확인했다. 이는 실제 Windows 실행이나 스크린리더 음성 검증은 아니다.

# 속성 패널 용어·입력 안내 (#289 마지막 범위)

기준 develop: `66402ab8925170b42b66788f2a3d8f49d07564c2` (#344 병합).

## 화면과 입력 계약

- 속성 순서와 섹션 구성을 유지하고 제목을 한국어 (기존 영문)로 표시한다.
  내용 → 크기 → 글꼴·색 등 기존 `nodeSections.ts` 순서를 변경하지 않는다.
- 크기 모드는 고정 (Fixed), 내용 맞춤 (Hug), 공간 채움 (Fill)이다.
  현재 모드의 한국어 설명과 숫자 입력 시 고정 크기로 바뀐다는 안내를 연결한다.
  저장 값은 기존 number / auto / fill 그대로다.
- 기본 image, breakpoint image, 배경 image가 기존 `FIT_OPTIONS` 설명을 공유한다.
  버튼의 title과 접근 가능한 이름에 동일한 설명을 쓴다.
- 일반 문자열·숫자·선택 입력은 `label[for]`와 고유 id를 연결한다.
  복합 색상·크기 입력은 각 컨트롤의 이름을 유지한다. 그룹에는 화면 라벨을 연결한다.
- 숫자/크기/색상/불투명도 오류는 `오류:` 문구, 범위/형식 안내, `aria-invalid`,
  `aria-describedby`를 제공한다. 오류 설명은 alert이며 색상만으로 구분하지 않는다.
  **무효 draft는 blur 뒤에도 남고 유효한 값만 커밋한다.** `useDraftInput`, editBurst와
  스토어/Command/스키마는 변경하지 않는다.
- 정상적인 빈 텍스트·미지정 선택 속성·상속된 값은 오류가 아니다.
  빈 배경과 이미지에는 추가/입력 방법을 일반 안내로 표시한다.
- 공통 입력·섹션·선택·추가/삭제 버튼은 기존 `outline-content` 2px 포커스 패턴을 쓴다.
  280px 패널에서 색상 hex 공간을 확보하려고 불투명도만 다음 줄에 둔다.

## 검증

`test/editing-context-render.test.ts`는 실제 컴포넌트의 label/id 연결 및 정상적인 빈 값,
기존 선택·반응형 문맥 표시를 검사한다. 기존 입력·undo 테스트도 전체 실행한다.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm generate:types
# 별도 터미널에서 격리된 빈 작업공간 Vite를 실행
VISUAL_SPEC_WORKSPACE=/absolute/path/to/empty-workspace pnpm exec vite --host 127.0.0.1 --port 5193
python scripts/browser/property-guidance.py http://127.0.0.1:5193
python scripts/browser/editing-context.py http://127.0.0.1:5193
```

`property-guidance.py`는 실제 패널에서 root와 노드 5종의 base/tablet 입력 이름·섹션 순서,
잘못된 입력 후 수정, blur 시 무효 입력 보존, 타이핑 burst/Undo, 배경 추가·삭제·Undo,
이미지 fit 설명 재사용, 빈 텍스트와 이미지, Tab/Shift+Tab, 섹션/패널 접기, 280px 폭,
두 테마의 설명/오류/포커스 대비를 검사한다. OS 임시 `vsb-property-guidance` 폴더에
스크린샷과 실측 JSON을 기록한다. 한글은 Chromium CDP IME composition으로 입력하며
실제 OS 한글 입력기와 스크린리더 음성, 실제 AI 생성 실행을 검증했다고 주장하지 않는다.
Vite가 소스 변경으로 재시작되지 않도록 생성/전체 테스트 뒤 새 서버에서 브라우저 검사를 실행한다.
편집 fixture는 schema validator를 통과한다. 빈 이미지 src는 기존 필수 src 규칙을 바꾸지 않고
표시만 별도 fixture로 검사하며, 유효한 편집/저장 성공 근거로 사용하지 않는다.

## #289 수용 조건 매핑

| 수용 조건 | 근거 |
|---|---|
| 저장됨/수정됨/초안 보관/충돌 지속 표시 | #344 및 `save-status.md`: 실제 내용 관측, 경합·복구 회귀 포함 |
| 선택 범위·반응형 편집 기준·속성 중요도 | #340 및 `editing-context.md`: 지속 표시, base/override/preview 구별, 기존 속성 순서 유지 |
| 용어·툴팁·오류/빈 상태와 GUI 동작 | 이 PR의 한국어 안내·라벨 연결·오류/빈 상태·실제 패널 회귀 |
| B09 숨은 툴바 포커스 | 완료된 #275. 이 PR에서 툴바 변경 없음 |
| B10 활성 안내 대비 | 완료된 #276의 의미 토큰 재사용 + 이 PR의 패널 실측 |

위 변경을 합쳐 #289의 지정 수용 범위를 충족하는 것으로 판단한다. 전체 앱 접근성
재설계나 WCAG 전체 적합성 인증을 의미하지 않는다. #280/#282/#290/#281/#284는 제외하며,
최종 SHA와 Windows 포함 CI 결과는 Draft PR에 기록한다. 머지는 리뷰 이후 별도 결정이다.

실측 결과: Chromium 151.0.7922.173, 280px 패널에서 가로 넘침 없음.
포커스·오류 대비는 light 15.13:1 / dark 11.31:1, 일반 설명은 light 7.81:1 / dark 6.43:1.
키보드 포커스 outline은 두 테마 모두 2px다. 전체 테스트 1,839개 및 opt-in Chromium 3개 통과.

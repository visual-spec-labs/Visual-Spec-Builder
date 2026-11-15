# Grid 코드 생성 QA (#268)

## 수정한 매핑

`grid-cols-[2]`는 Tailwind 4.3.3에서 `grid-template-columns: 2`를 생성해 유효한 트랙이
아니었다. 1·2·3열을 `grid-cols-[repeat(N,1fr)]`로 출력하도록 규칙과 `form-grid` 예제를
수정했다. 컴파일 결과는 `repeat(1,1fr)`, `repeat(2,1fr)`, `repeat(3,1fr)`다.

`crossAxis`도 GUI와 같은 `align-items`로 출력한다. `start`/`center`/`end`/`stretch`는 각각
`items-start`/`items-center`/`items-end`/`items-stretch`다. 자식의 `fill`/`auto` 크기는
grid cell 기준 `w-full`/`h-full` 및 `w-auto`/`h-auto`로 확인한다.

## 실제 컴파일 및 브라우저 비교

`test/grid-codegen-browser.test.ts`는 스킬 규칙대로 만든 React 마크업과 실제 앱의
`frameStyle`/`boxStyle` 결과를 각각 렌더한다. 두 쪽 모두 Tailwind 4.3.3으로 컴파일한
유틸리티 CSS와 Chromium을 사용한다. 1·2·3열과 4개 교차축 값에서 트랙 너비·정렬·각 자식의
위치와 크기를 비교한다. 자식은 auto 높이의 짧은/두 줄 콘텐츠와 fill 크기를 함께 포함한다.

```powershell
$env:VSB_GRID_BROWSER = '1'
$env:CHROME_BIN = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
pnpm test -- test/responsive-codegen.test.ts test/grid-codegen-browser.test.ts
```

Chrome headless 실측에서 620px 그리드의 콘텐츠 트랙은 1열 596px, 2열 292px씩,
3열 190.656/190.672/190.672px였다. `start`에서는 2열 첫 행의 auto 자식 높이가 32px와
56px로 유지됐고, `stretch`에서는 같은 행이 104px 트랙을 채웠다. `center`/`end` 정렬도
GUI의 `frameStyle` 좌표와 같았다. `fill` 및 `auto` 자식의 좌표·크기도 모든 비교에서
일치했다.

반응형 fixture는 요청 viewport 699→700→899→900→901→699px 순서로 별도의 headless
Chromium 프로세스/profile에서 열어 확인했다. 같은 페이지에서 viewport를 왕복 리사이즈한
검증은 아니다. 700px에서 2열/center/gap 12px, 900px에서 3열/stretch/gap 20px로 바뀌고,
699px 실행은 1열/start/gap 8px를 반환했다. 각 viewport에서 트랙 정의·간격·자식 배치가
대응하는 GUI style 결과와 같았다.

검증 결과: `responsive-codegen.test.ts` 6개 통과, Chrome 브라우저 비교 1개 통과,
typecheck/lint/build 통과. 실제 외부 AI 코드 생성은 실행하지 않았다. 브라우저 비교는
수동 매핑 fixture와 앱의 순수 style 계산을 대조한 결과다.

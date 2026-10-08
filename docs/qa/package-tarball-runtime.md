# 로컬 tarball GUI 런타임 QA (#277)

공개 레지스트리에 배포하지 않는 `private: true` 패키지를 `pnpm pack`으로 만든 뒤,
저장소 의존성이 없는 새 폴더에 설치해 확인했다.

## 확인 결과

- tarball(약 398 KB)에 `bin/`, `src/`, `vite.config.ts`, `index.html`, 예제와 스킬이
  들어 있고, 스킬 설치에 필요한 계약 문서 5개만 포함됐다. 개발 기록을 포함하는 나머지
  `docs/`는 tarball에서 제외된다.
- Vite와 React/Tailwind Vite 플러그인이 패키지 런타임 의존성으로 설치됐다.
- 새 프로젝트에서 `visual-spec init`, `visual-spec skills`, `visual-spec validate`
  를 실행했다. 네 작업공간 폴더, Claude/Codex 스킬과 계약 사본이 만들어졌고 예제 스펙이
  유효했다.
- 설치본의 CLI가 GUI 개발 서버를 띄우고 앱 HTML 및 `/src/main.tsx`를 제공했다.
  `/__vs/status`가 사용자 프로젝트 아래 `.visual-spec/` 경로를 반환했다.
- GUI 파일 API로 스펙을 저장하고 다시 열어 내용이 일치하는지 확인했다. 자연어 요청 잠금을
  잡은 뒤 `runtime/nl-request.json`을 쓰고, 생성 코드 경로
  `generated/pages/Home.tsx`에도 파일을 썼다. 모든 요청이 HTTP 200이었다.
- Export 회귀 테스트 6개와 pnpm hoisted Vite 의존성 경로 회귀 테스트 1개가 통과했다.

## 검증 명령

- `pnpm pack --pack-destination <임시 폴더>`
- 새 임시 프로젝트에서 tarball 설치 후 `visual-spec init`, `visual-spec skills`,
  `visual-spec validate examples/login-screen.json`
- `pnpm test -- test/cli-gui.test.ts -t "pnpm hoisted"`
- `pnpm test -- test/export-generated-code.test.ts`

브라우저에서 버튼을 눌러 Export ZIP을 다운로드하는 수동 UI 검증은 이 기록에 포함하지 않는다.
GUI 페이지 제공과 Export 코드의 회귀 테스트를 각각 확인했다.

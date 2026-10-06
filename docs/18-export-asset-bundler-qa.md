# Export 이미지 번들러 QA (#270)

## 계약

생성 페이지·컴포넌트는 이미지 파일을 브라우저 URL로 조립하지 않고 정적 모듈 import로 참조한다.
ZIP은 `pages/`, `components/`, `assets/`를 같은 소스 폴더 아래 유지한다. Vite 등 번들러가
개발 서버 URL과 production 출력 URL을 만들고 앱의 `base` 설정을 반영한다. ImageNode와 CSS
image background는 같은 파일명·import 규칙을 사용한다.

Export 검사는 `../assets/<파일명>` import의 파일 존재 여부를 확인하고, 일치한 파일을
`usedAssets`에 넣어 ZIP에 포함한다. 이 검사는 브라우저 로딩 검사를 대신하지 않는다.
ZIP README는 두 검사의 차이를 설명하고 소스 폴더 안에 결과를 함께 두도록 안내한다.

## 수동 브라우저 fixture

`test/fixtures/codegen-assets-vite/`는 ImageNode에 대응하는 `<img>`와 CSS background가 각각
정적 import된 SVG를 사용한다. 첫 파일명 `한글-사진 (1)+100-.svg`에는 한글·공백·괄호·`+`가
있다. `%`와 `#`는 URL escape 또는 fragment로 처리될 수 있어 Import 시 하이픈으로 정규화한다.

2026-10-06 Chrome headless에서 fixture를 Vite 개발 서버와 production preview로 각각 열어
DOM의 이미지 자연 너비와 최종 URL을 확인했다.

| 실행 | ImageNode | 배경 이미지 | 확인 |
|---|---:|---:|---|
| 개발 서버 | `naturalWidth = 7` | `naturalWidth = 11` | 둘 다 로드, Vite가 작은 SVG를 data URI로 제공 |
| production preview, `base=/nested-preview/`, `assetsInlineLimit=0` | `naturalWidth = 7` | `naturalWidth = 11` | 둘 다 `/nested-preview/assets/` 아래 해시 자산 URL로 로드 |

production 브라우저 측정 URL 예: `/nested-preview/assets/%ED%95%9C%EA%B8%80-%EC%82%AC%EC%A7%84%20(1)_100--h8DcYyBW.svg`.
브라우저가 한글과 공백을 URL 인코딩했으며 이미지 로딩 후 `naturalWidth`는 7이었다.

fixture는 수동 작성한 입력이다. 실제 Claude Code/Codex 실행은 이 QA에서 수행하지 않았다.

## 회귀 검사

- `test/asset-name.test.ts`: 파일명 정규화
- `test/verify-generated.test.ts`: 정적 import 인식, 누락 자산, 실제 자산 목록
- `test/export-bundle.test.ts`: README 설명과 ZIP의 페이지·자산 경로
- `test/image-fill.test.ts`: ImageNode·배경 이미지 생성 지침

검증 결과:

- 관련 회귀 74개 통과, 반응형 코드 생성 회귀 4개 통과
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run build` 통과
- `pnpm run generate:types` 후 생성 타입 diff 없음
- 전체 테스트: 1,481 통과, 1 skipped, 11 실패. 실패는 Windows에서 symlink 생성이 `EPERM`으로
  거부되거나 chmod 기반 읽기 권한 테스트가 Windows 권한 모델에서 기대대로 재현되지 않은 항목이다.
  전체 Linux CI 결과도 확인한다.

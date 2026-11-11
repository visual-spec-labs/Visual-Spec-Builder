# Untitled

Visual Spec Builder가 내보낸 React 화면 코드입니다. 이 폴더는 그대로 복사해 쓸 수 있도록
프로젝트 전용 경로 별칭 없이 상대 경로 import만 씁니다.

## 실행 방법

이 폴더 자체는 앱이 아니라 컴포넌트 묶음입니다. React + Tailwind CSS가 이미 있는
프로젝트에 넣어 씁니다.

**들어 있지 않은 것** — 앱 셸(`index.html`·`main.tsx`)·라우터 설정, 폼 상태·입력 검증·제출,
데이터 불러오기, 인증·백엔드, hover·focus·disabled 상태 스타일, 배포 설정. 입력·버튼은 모양만 있는 정적 마크업이고,
표·카드의 값은 스펙에 적힌 정적 텍스트입니다. 스펙에 이미지 대체 텍스트가 없어 보통 비워 둡니다
(`alt=""`, 장식용) — 의미 있는 이미지라면 통합할 때 채워 주세요.

```bash
npm install react
```

## 통합 방법

1. 이 폴더를 대상 프로젝트의 소스 디렉터리 안에 통째로 복사합니다(예: src/visual-spec/).
   `pages/`·`components/`·`assets/`의 상대 위치는 **바꾸지 않습니다** — 서로를
   `../components/…`·`../assets/…`로 가리키고 있습니다.
2. `package.json`의 의존성이 대상 프로젝트에 있는지 확인합니다.
3. 페이지 컴포넌트를 라우터에 연결합니다.
   이미지 파일은 TSX의 정적 import로 참조합니다. Vite 같은 번들러가 개발 중 파일을 제공하고,
   production build에서 출력 URL로 바꾸며, 앱의 base 설정(하위 경로 배포 포함)도 적용합니다.
4. 스타일은 Tailwind CSS 유틸리티 클래스입니다. **Tailwind v4**(`@tailwindcss/vite` 등
   Vite 플러그인 방식)는 모듈 그래프를 자동으로 훑어 별도 설정 없이도 이 폴더의
   클래스를 찾아냅니다. **v3 이하**를 쓴다면 `tailwind.config`의 `content` 배열에 이
   폴더를 직접 추가해야 클래스가 적용됩니다.

자동 병합은 하지 않습니다 — 통합은 사용자가 직접 합니다(`docs/02-mvp-scope.md` MVP 제외 범위).

## 검증 결과

파일 4개 · 티켓 4개 중 4개 포함 · 오류 0건

| 파일 | 컴포넌트 | 상태 |
|---|---|---|
| `components/Hero.tsx` | Hero | 포함됨 |
| `components/FeatureCard1.tsx` | FeatureCard1 | 포함됨 |
| `components/Features.tsx` | Features | 포함됨 |
| `pages/Landing.tsx` | Landing | 포함됨 |

검증에서 발견된 문제가 없습니다.

### 확인한 것

- 구현 티켓마다 대응하는 파일이 있는지
- `@/` 같은 경로 별칭·절대 경로 import가 없는지
- 상대 경로 import가 실제로 있는 파일을 가리키는지
- 상대 경로가 이 폴더 밖으로 나가지 않는지
- 정적 `../assets/…` 이미지 import가 실제로 있는지 — 이미지 배경도 같은 import를 사용합니다

### 확인하지 않은 것

- **타입 검사(`tsc`)** — 대상 프로젝트의 tsconfig와 React 타입 버전을 알아야 합니다.
  **project references를 쓰는 프로젝트**(`tsconfig.json`이 `files: []` + `references`만
  갖고 실제 설정은 `tsconfig.app.json` 등에 있는 Vite 템플릿이 대표적입니다)에서는
  `tsc --noEmit`만으로는 아무것도 검사되지 않습니다 — `tsc -b --noEmit`(또는 `tsc -b`)를
  써야 실제로 돕니다
- **lint·포매팅** — 대상 프로젝트의 규칙을 따릅니다
- **화면이 스펙과 같게 그려지는지** — 렌더 비교는 MVP 제외 범위입니다
- import 구문은 정규식으로 훑습니다. 주석 안 문자열을 잘못 잡거나 동적 경로를 놓칠 수 있습니다

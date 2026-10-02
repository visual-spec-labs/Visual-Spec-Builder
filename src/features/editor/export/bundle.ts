/**
 * 내보낼 결과 폴더의 내용물을 만든다 — 순수 함수 (이슈 #157).
 *
 * ## 폴더 모양
 *
 * ```
 * <프로젝트명>/
 * ├── pages/<PageName>.tsx
 * ├── components/<ComponentName>.tsx
 * ├── assets/<참조된 이미지>
 * ├── package.json
 * └── README.md
 * ```
 *
 * 02-mvp-scope.md의 "Export 결과 예시"는 페이지를 폴더 맨 위에 두고 `components/`만
 * 하위에 뒀지만 **`generated/`의 배치를 그대로 옮긴다.** 생성된 코드가 이미
 * `../components/Card`처럼 `pages/`에서 한 단계 올라가는 상대 경로로 서로를
 * 가리키고 있어서(`skills/visual-spec-to-react/SKILL.md` 3절), 배치를 바꾸면
 * 그 import가 전부 깨진다. 02의 예시는 폴더 하나로 독립한다는 뜻을 보인 그림이지
 * 강제 규격이 아니다.
 *
 * `assets/`를 `pages/`·`components/` 옆에 두는 것도 같은 이유다 — 코드가 적어 둔
 * `../assets/hero.png`가 **내보낸 폴더 안에서 그대로 맞는 경로**가 된다.
 */

import type { VerifyReport } from "./verifyGenerated";
import type { GeneratedFile } from "./verifyGenerated";
import { utf8Bytes, type ZipEntry } from "./zip";

/** 작업공간 `assets/`에서 가져온 이미지 한 장. */
export interface BundleAsset {
  name: string;
  bytes: Uint8Array;
}

/**
 * ZIP 안 최상위 폴더 이름. 프로젝트 이름을 파일 시스템이 받아들이는 형태로 줄인다.
 *
 * 압축을 풀면 이 이름의 폴더 하나만 생긴다 — 파일이 현재 폴더에 흩어지지 않게
 * (tar bomb 방지) 모든 항목을 이 아래에 담는다.
 */
export function bundleFolderName(projectName: string): string {
  const cleaned = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned === "" ? "visual-spec-export" : cleaned;
}

/** 내려받을 파일 이름. */
export function bundleFileName(projectName: string): string {
  return `${bundleFolderName(projectName)}.zip`;
}

/**
 * 내보낸 폴더가 혼자 설치될 수 있도록 package.json을 만든다.
 *
 * 버전을 고정하지 않고 `*`로 둔다 — 여기서 고른 버전 범위가 사용자 프로젝트에 이미
 * 설치된 것과 충돌하면 통합이 오히려 어려워진다. 02-mvp-scope.md가 요구한 것은
 * "필요한 패키지 **목록** 제공"이고, 어느 버전을 쓸지는 통합하는 쪽이 정한다.
 *
 * TSX는 `react` 없이 성립하지 않으므로 코드에 import가 없어도 항상 넣는다
 * (JSX 자동 런타임을 쓰면 소스에 `import React`가 없다).
 *
 * **`*`가 실제 설치에서 문제가 되는지 수동으로 확인했다**(이슈 #188) — `examples/
 * dashboard-cards.json`을 내보내 받은 `package.json` 하나만 떼어 `pnpm install`을
 * 돌려도 `react`가 최신으로 정상 해석된다. 실제 통합 시나리오(이미 `react`가 설치된
 * 프로젝트에 이 폴더를 얹는 것)에서는 이 파일을 그대로 설치하지 않고 README가 안내한
 * 대로 "이미 있는지 확인하는 목록"으로만 쓰이므로 더더욱 문제가 안 된다.
 */
export function buildPackageJson(projectName: string, packages: string[]): string {
  const dependencies: Record<string, string> = {};
  for (const name of [...new Set(["react", ...packages])].sort((a, b) => a.localeCompare(b))) {
    dependencies[name] = "*";
  }

  return `${JSON.stringify(
    {
      name: bundleFolderName(projectName),
      version: "0.1.0",
      private: true,
      description: `Visual Spec Builder가 내보낸 ${projectName} 화면 코드`,
      dependencies,
    },
    null,
    2,
  )}\n`;
}

function issueTable(report: VerifyReport): string {
  if (report.issues.length === 0) return "검증에서 발견된 문제가 없습니다.\n";

  const rows = report.issues
    .map((issue) => {
      const where = issue.line === undefined ? issue.file : `${issue.file}:${issue.line}`;
      const level = issue.severity === "error" ? "오류" : "참고";
      return `| ${level} | \`${where}\` | ${issue.message} |`;
    })
    .join("\n");

  return `| 심각도 | 위치 | 내용 |\n|---|---|---|\n${rows}\n`;
}

/**
 * 실행 방법·통합 방법·검증 결과를 담은 README (02-mvp-scope.md "결과물 원칙").
 *
 * **검증에서 못 본 것을 같이 적는다.** 검증을 통과했다는 문장만 남기면 읽는 쪽이
 * "타입까지 맞다"로 읽는다. 무엇을 확인했고 무엇은 확인하지 않았는지가 같은 자리에
 * 있어야 한다.
 */
export function buildReadme(projectName: string, report: VerifyReport): string {
  const fileList = report.coverage
    .map((entry) => `| \`${entry.expectedPath}\` | ${entry.componentName} | ${entry.found ? "포함됨" : "**없음**"} |`)
    .join("\n");

  return `# ${projectName}

Visual Spec Builder가 내보낸 React 화면 코드입니다. 이 폴더는 그대로 복사해 쓸 수 있도록
프로젝트 전용 경로 별칭 없이 상대 경로 import만 씁니다.

## 실행 방법

이 폴더 자체는 앱이 아니라 컴포넌트 묶음입니다. React + Tailwind CSS가 이미 있는
프로젝트에 넣어 씁니다.

\`\`\`bash
npm install react
\`\`\`

## 통합 방법

1. 이 폴더를 대상 프로젝트 안 원하는 위치에 통째로 복사합니다.
   \`pages/\`·\`components/\`·\`assets/\`의 상대 위치는 **바꾸지 않습니다** — 서로를
   \`../components/…\`·\`../assets/…\`로 가리키고 있습니다.
2. \`package.json\`의 의존성이 대상 프로젝트에 있는지 확인합니다.
3. 페이지 컴포넌트를 라우터에 연결합니다.
4. 스타일은 Tailwind CSS 유틸리티 클래스입니다. **Tailwind v4**(\`@tailwindcss/vite\` 등
   Vite 플러그인 방식)는 모듈 그래프를 자동으로 훑어 별도 설정 없이도 이 폴더의
   클래스를 찾아냅니다. **v3 이하**를 쓴다면 \`tailwind.config\`의 \`content\` 배열에 이
   폴더를 직접 추가해야 클래스가 적용됩니다.

자동 병합은 하지 않습니다 — 통합은 사용자가 직접 합니다(\`docs/02-mvp-scope.md\` MVP 제외 범위).

## 검증 결과

파일 ${report.fileCount}개 · 티켓 ${report.coverage.length}개 중 ${report.coveredCount}개 포함 · 오류 ${report.errorCount}건

| 파일 | 컴포넌트 | 상태 |
|---|---|---|
${fileList === "" ? "| — | — | 티켓 없음 |" : fileList}

${issueTable(report)}
### 확인한 것

- 구현 티켓마다 대응하는 파일이 있는지
- \`@/\` 같은 경로 별칭·절대 경로 import가 없는지
- 상대 경로 import가 실제로 있는 파일을 가리키는지
- 상대 경로가 이 폴더 밖으로 나가지 않는지
- 코드가 참조하는 \`../assets/…\` 이미지가 실제로 있는지

### 확인하지 않은 것

- **타입 검사(\`tsc\`)** — 대상 프로젝트의 tsconfig와 React 타입 버전을 알아야 합니다.
  **project references를 쓰는 프로젝트**(\`tsconfig.json\`이 \`files: []\` + \`references\`만
  갖고 실제 설정은 \`tsconfig.app.json\` 등에 있는 Vite 템플릿이 대표적입니다)에서는
  \`tsc --noEmit\`만으로는 아무것도 검사되지 않습니다 — \`tsc -b --noEmit\`(또는 \`tsc -b\`)를
  써야 실제로 돕니다
- **lint·포매팅** — 대상 프로젝트의 규칙을 따릅니다
- **화면이 스펙과 같게 그려지는지** — 렌더 비교는 MVP 제외 범위입니다
- import 구문은 정규식으로 훑습니다. 주석 안 문자열을 잘못 잡거나 동적 경로를 놓칠 수 있습니다
`;
}

export interface BundleInput {
  projectName: string;
  files: GeneratedFile[];
  assets: BundleAsset[];
  report: VerifyReport;
}

/** ZIP에 그대로 넘길 항목 목록을 만든다. 경로는 모두 최상위 폴더 아래로 들어간다. */
export function buildBundleEntries({
  projectName,
  files,
  assets,
  report,
}: BundleInput): ZipEntry[] {
  const root = bundleFolderName(projectName);

  return [
    ...files.map((file) => ({
      path: `${root}/${file.path}`,
      bytes: utf8Bytes(file.content),
    })),
    ...assets.map((asset) => ({
      path: `${root}/assets/${asset.name}`,
      bytes: asset.bytes,
    })),
    {
      path: `${root}/package.json`,
      bytes: utf8Bytes(buildPackageJson(projectName, report.packages)),
    },
    { path: `${root}/README.md`, bytes: utf8Bytes(buildReadme(projectName, report)) },
  ];
}

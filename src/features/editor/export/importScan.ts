/**
 * 생성된 TSX에서 import 구문과 assets 참조를 찾아내는 순수 함수 (이슈 #157).
 *
 * ## 왜 정규식인가 — 그리고 그 대가
 *
 * 제대로 하려면 TypeScript 파서가 필요하다. 이 저장소에 파서가 없고(의존성 추가는
 * 이 작업 범위 밖) `typescript` 패키지를 브라우저 번들에 넣는 것은 검사 하나를 위해
 * 치르기엔 큰 값이다. 그래서 **구문 단위 정규식**으로 훑는다.
 *
 * 놓치거나 잘못 잡는 경우가 실제로 있다:
 * - 주석이나 문자열 안에 적힌 `import ... from "x"`도 잡힌다(오탐)
 * - `require("x")`·변수로 만든 경로는 못 잡는다(누락)
 *
 * 둘 다 **검사 결과를 부풀리거나 줄일 뿐 파일을 건드리지는 않는다.** 검증은 사용자가
 * 읽고 판단하는 목록이고, 못 보는 것은 화면과 README에 적어 둔다. 정확한 판정은
 * 사용자 프로젝트에서 `tsc`를 돌려야 나오는데 그건 애초에 앱 안에서 못 한다.
 */

/** 소스에서 찾은 import 하나. */
export interface ImportRef {
  /** 따옴표 안 문자열 그대로. `"../components/Card"` */
  specifier: string;
  /** 1부터 세는 줄 번호 — 화면에 그대로 보여준다. */
  line: number;
}

/**
 * `import ... from "x"` · `export ... from "x"` · `import "x"` · `import("x")`.
 *
 * 가운데를 `[^'"();]*`로 묶어 **따옴표·세미콜론·괄호를 건너뛰지 못하게** 했다.
 * `[\s\S]*?`로 두면 한참 아래 줄의 엉뚱한 문자열까지 한 구문으로 이어 붙인다.
 * 줄바꿈은 허용해야 한다 — 여러 줄에 걸친 `import { A, B } from "x"`가 흔하다.
 */
const IMPORT_PATTERNS = [
  /\b(?:import|export)\b[^'"();]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/** 문자열 시작부터 `index`까지의 줄 수(1부터). */
function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

/**
 * 소스의 모든 import 대상을 훑는다. 같은 자리를 두 패턴이 잡으면 하나만 남긴다
 * (`import "x"` 패턴은 `import x from "y"`의 뒷부분과 겹치지 않지만, 앞으로 패턴을
 * 늘릴 때를 대비해 위치 기준으로 접어 둔다).
 */
export function scanImports(source: string): ImportRef[] {
  const byIndex = new Map<number, ImportRef>();

  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      byIndex.set(match.index, { specifier: match[1], line: lineAt(source, match.index) });
    }
  }

  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, ref]) => ref);
}

/**
 * import 대상이 어떤 종류인지 가른다.
 *
 * - `relative` — `./`·`../`. 결과 폴더 안에서 풀린다
 * - `alias` — `@/`·`~/`·절대 경로·Windows 드라이브. **02-mvp-scope.md "결과물 원칙"이
 *   금지한 것**이다("프로젝트 전용 경로 별칭 사용 금지"). `@scope/pkg`는 여기 들지
 *   않는다 — 그건 정상적인 npm 스코프 패키지다
 * - `package` — 나머지 bare specifier. package.json에 적을 후보가 된다
 */
export type SpecifierKind = "relative" | "alias" | "package";

export function classifySpecifier(specifier: string): SpecifierKind {
  if (specifier.startsWith("./") || specifier.startsWith("../")) return "relative";
  if (specifier === "." || specifier === "..") return "relative";
  if (specifier.startsWith("@/") || specifier.startsWith("~/")) return "alias";
  if (specifier.startsWith("/") || specifier.startsWith("\\")) return "alias";
  if (/^[A-Za-z]:[\\/]/.test(specifier)) return "alias";
  return "package";
}

/**
 * bare specifier에서 패키지 이름만 뽑는다. `react-dom/client` → `react-dom`,
 * `@tanstack/react-query/x` → `@tanstack/react-query`.
 */
export function packageNameOf(specifier: string): string {
  const parts = specifier.split("/");
  if (specifier.startsWith("@")) return parts.slice(0, 2).join("/");
  return parts[0];
}

/**
 * 소스 안의 assets 참조(`../assets/hero.png`)를 찾아 **파일 이름만** 돌려준다.
 *
 * `../`가 몇 겹이든 받는다. SKILL.md는 `../assets/<파일명>`으로 정해 뒀지만 그
 * 문서 자신이 "정확한 경로 depth는 확정된 게 아니다"라고 단서를 달았고, 실제로
 * 작업공간에서는 `generated/pages/`에서 `.visual-spec/assets/`까지 두 단계다.
 * 어느 쪽으로 적혀 있든 가리키는 것은 작업공간의 같은 assets 폴더 하나뿐이라,
 * depth를 따지는 대신 파일 이름으로 맞춰 본다.
 *
 * **내보낸 폴더에서는 `../assets/`가 맞는 표기가 된다** — ZIP은 `pages/`·`components/`
 * 옆에 `assets/`를 나란히 담기 때문이다(`bundle.ts`).
 */
const ASSET_REFERENCE = /(?:\.\.\/)+assets\/([^"'`\s)]+)/g;

export function scanAssetReferences(source: string): string[] {
  const names = new Set<string>();
  ASSET_REFERENCE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ASSET_REFERENCE.exec(source)) !== null) {
    names.add(match[1]);
  }
  return [...names];
}

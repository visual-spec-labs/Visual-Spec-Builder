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

interface LocatedImport extends ImportRef {
  start: number;
  end: number;
}

/**
 * `import ... from "x"` · `export ... from "x"` · `import "x"` · `import("x")`.
 *
 * import 절은 따옴표·세미콜론·괄호를 넘어가지 않게 하고, 모듈 문자열은 시작한
 * 따옴표와 같은 문자로 닫히게 한다. 따옴표 종류가 다른 파일명 문자와 escape도
 * 허용하면서 여러 줄 import의 specifier를 정확히 읽는다.
 */
const IMPORT_PATTERNS = [
  /\b(?:import|export)\b[^'"();]*?\bfrom\s*("|')((?:\\.|(?!\1)[^\\\r\n])*)\1/g,
  /\bimport\s*("|')((?:\\.|(?!\1)[^\\\r\n])*)\1/g,
  /\bimport\s*\(\s*("|')((?:\\.|(?!\1)[^\\\r\n])*)\1\s*\)/g,
];

function unescapeSpecifier(specifier: string): string {
  return specifier.replace(/\\(["'\\])/g, "$1");
}

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
function scanLocatedImports(source: string): LocatedImport[] {
  const byIndex = new Map<number, LocatedImport>();

  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      byIndex.set(match.index, {
        specifier: unescapeSpecifier(match[2]),
        line: lineAt(source, match.index),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, ref]) => ref);
}

export function scanImports(source: string): ImportRef[] {
  return scanLocatedImports(source).map(({ specifier, line }) => ({ specifier, line }));
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
 * CSS background URL과 정적 번들러 import에서 자산 파일명을 모은다.
 *
 * CSS URL은 URL 인코딩을 decode해 작업공간 원본 파일명과 비교한다. 모듈 import는
 * URL이 아니라 파일 시스템 경로이므로 문자열을 그대로 둔다. Export 배치에서는
 * `pages/`·`components/`와 `assets/`가 형제라 이미지 import는 `../assets/<파일명>`이다.
 */
const ASSET_REFERENCE = /(?:\.\.\/)+assets\/([^"'`\s)\\]+)/g;

/** An exported page/component imports an image from its sibling assets folder. */
export function assetImportName(specifier: string): string | null {
  const match = /^\.\.\/assets\/([^/]+)$/.exec(specifier);
  if (match === null || !/\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i.test(match[1])) return null;
  return match[1];
}

export function scanAssetReferences(
  source: string,
  options: { includeStaticImports?: boolean } = {},
): string[] {
  const names = new Set<string>();
  const assetImports = scanLocatedImports(source).filter(({ specifier }) => assetImportName(specifier) !== null);
  const withoutAssetImports = assetImports
    .slice()
    .sort((a, b) => b.start - a.start)
    .reduce((remaining, reference) => {
      const statement = remaining.slice(reference.start, reference.end)
        .replace(/[^\r\n]/g, " ");
      return remaining.slice(0, reference.start) + statement + remaining.slice(reference.end);
    }, source);
  // A generated JS string may escape CSS delimiters (url(\"…\")); the opposite
  // quote is a valid filename character. Match the same delimiter at both ends.
  const remaining = withoutAssetImports.replace(/url\(\s*(\\?["'])(.*?)\1\s*\)/g,
    (_match, _quote: string, path: string) => {
      if (/^(?:\.\.\/)+assets\//.test(path)) {
        names.add(decodeAssetName(path.replace(/^(?:\.\.\/)+assets\//, "")));
      }
      return "";
    });
  ASSET_REFERENCE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ASSET_REFERENCE.exec(remaining)) !== null) {
    names.add(decodeAssetName(match[1]));
  }
  // Static imports are the bundler contract. Keep their literal module path intact:
  // unlike a URL in CSS, percent sequences in an import are filename characters.
  if (options.includeStaticImports !== false) {
    for (const reference of assetImports) {
      const name = assetImportName(reference.specifier);
      if (name !== null) names.add(name);
    }
  }
  return [...names];
}

/** Generated asset URLs encode each filename segment; the workspace list holds raw names. */
function decodeAssetName(name: string): string {
  try { return decodeURIComponent(name); } catch { return name; }
}

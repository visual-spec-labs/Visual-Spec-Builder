/**
 * `.visual-spec/generated/` 안의 경로를 다루는 순수 함수 (이슈 #157).
 *
 * **`node:path`를 쓰지 않는다.** 이 코드는 브라우저 번들에 들어가고, 여기서 다루는
 * 경로는 파일 시스템 경로가 아니라 **언제나 `/`로 구분되는 작업공간 상대 경로**다
 * (목록 라우트가 플랫폼과 무관하게 `/`로 준다 — `workspaceServer.handleList`).
 * Windows 구분자를 섞을 여지를 아예 두지 않으려고 문자열로 직접 다룬다.
 */

import type { Ticket } from "@/features/editor/ticket/types";

/** 페이지 컴포넌트가 놓이는 하위 폴더. `skills/visual-spec-to-react/SKILL.md` 4번. */
export const PAGES_DIR = "pages";

/** 나머지 컴포넌트가 놓이는 하위 폴더. 같은 문서 같은 절. */
export const COMPONENTS_DIR = "components";

/**
 * import 구문이 확장자를 생략했을 때 붙여 볼 후보들.
 *
 * 순서가 곧 우선순위다 — TSX 프로젝트라 `.tsx`를 먼저 본다. 번들러가 실제로 어떤
 * 순서로 찾는지는 설정마다 다르지만, 여기서 정하는 건 "가리키는 파일이 있는가"뿐이라
 * 순서가 결과를 바꾸는 경우는 같은 이름의 파일이 확장자만 다르게 둘 있을 때뿐이다.
 */
const EXTENSION_CANDIDATES = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];

/**
 * 티켓 하나가 만들어져 있어야 할 파일 경로(`generated/` 기준).
 *
 * `kind`가 곧 폴더다 — page는 `pages/`, 나머지는 `components/`. SKILL.md가 정한
 * 고정 경로이므로 여기서 새로 정하는 것이 없다.
 */
export function ticketFilePath(ticket: Ticket): string {
  const dir = ticket.kind === "page" ? PAGES_DIR : COMPONENTS_DIR;
  return `${dir}/${ticket.componentName}.tsx`;
}

/** `pages/Home.tsx` → `pages`. 최상위 파일이면 빈 문자열. */
function dirNameOf(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? "" : path.slice(0, cut);
}

/**
 * `fromPath`가 있는 폴더를 기준으로 상대 경로를 풀어 `generated/` 기준 경로로 만든다.
 *
 * `generated/` 밖으로 나가면(`../../` 등) null이다 — 그건 결과 폴더 하나만 옮겨
 * 쓰는 순간 깨지는 참조라 "못 찾았다"가 아니라 **규칙 위반**으로 다뤄야 한다
 * (02-mvp-scope.md "결과물 원칙": 내보낸 폴더는 다른 앱에 그대로 넣어 쓸 수 있어야 한다).
 */
export function resolveRelativePath(fromPath: string, specifier: string): string | null {
  const base = dirNameOf(fromPath);
  const segments = base === "" ? [] : base.split("/");

  for (const segment of specifier.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return null; // generated/ 밖으로 나갔다
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.length === 0 ? null : segments.join("/");
}

/**
 * 상대 경로 import가 실제 파일을 가리키는지 본다.
 *
 * 돌려주는 값은 **찾은 파일의 경로**다(확장자를 생략했으면 붙여서). 못 찾으면 null,
 * `generated/` 밖으로 나가면 `"escaped"`.
 */
export type ImportTarget = { kind: "found"; path: string } | { kind: "missing" } | { kind: "escaped" };

export function resolveImportTarget(
  fromPath: string,
  specifier: string,
  existingPaths: ReadonlySet<string>,
): ImportTarget {
  const resolved = resolveRelativePath(fromPath, specifier);
  if (resolved === null) return { kind: "escaped" };

  for (const suffix of EXTENSION_CANDIDATES) {
    const candidate = `${resolved}${suffix}`;
    if (existingPaths.has(candidate)) return { kind: "found", path: candidate };
  }
  return { kind: "missing" };
}

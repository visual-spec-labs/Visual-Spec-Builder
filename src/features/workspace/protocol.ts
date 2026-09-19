/**
 * GUI(브라우저)와 Vite 개발 서버 미들웨어가 **같이** 쓰는 상수 모음 (이슈 #133).
 *
 * 이 파일만 `node:*`를 하나도 import하지 않는다 — 브라우저 번들에 들어가기 때문이다.
 * 실제 경로 해석·검증은 `workspacePath.ts`(node), 파일 입출력은 `workspaceServer.ts`(node).
 * `ui/theme-storage.ts`가 localStorage 키를 한 곳에 두고 vite.config.ts와 앱이 함께
 * 쓰는 것과 같은 패턴이다 — 양쪽이 다른 문자열을 쓰기 시작하면 조용히 깨진다.
 */

/** `npx visual-spec init`이 만드는 작업공간 폴더 이름. bin/visual-spec.mjs와 같은 값이어야 한다. */
export const WORKSPACE_DIR_NAME = ".visual-spec";

/** 작업공간 API의 공통 접두사. `__`로 시작해 사용자 라우트와 겹치지 않게 했다. */
export const WORKSPACE_API_PREFIX = "/__vs";

/** 파일 하나를 읽고(GET) 쓰는(PUT) 라우트. 뒤에 `<폴더>/<경로>`가 붙는다. */
export const WORKSPACE_FILE_ROUTE = `${WORKSPACE_API_PREFIX}/file/`;

/** 폴더 안 파일 목록(GET). 뒤에 `<폴더>`가 붙는다. */
export const WORKSPACE_LIST_ROUTE = `${WORKSPACE_API_PREFIX}/list/`;

/**
 * 작업공간 루트 기준 상대 경로(`specs/home.json`)를 파일 라우트 URL로 바꾼다.
 *
 * **세그먼트마다 인코딩한다.** 파일 이름에는 URL에서 뜻을 갖는 글자가 얼마든지
 * 들어온다 — `hero#1.png`를 그대로 붙이면 `#`부터가 조각(fragment)이라 서버에는
 * `hero`까지만 도착하고, `100%.png`는 `%.p`가 깨진 퍼센트 인코딩이라 디코딩 단계에서
 * 거부된다(`workspacePath.ts`의 `decodeSegment`). 공백·`?`·`+`도 같은 부류다.
 * 세그먼트를 나눠 인코딩하므로 경로 구분자 `/`는 살아남는다.
 *
 * **여기 있는 이유** (PR #145 리뷰, wook3964): 저장 요청(`ui/workspaceClient.ts`)과
 * 화면에 그릴 때(`ui/properties/imageSrc.ts`)가 **같은 규칙**으로 URL을 만들어야 한다.
 * 한쪽만 인코딩하면 저장은 되는데 그 이미지가 화면에서 깨진다 — 실제로 그랬다.
 * 양쪽이 함께 쓰는 값은 이 파일에 둔다는 것이 이 모듈의 원칙이다.
 */
export function workspaceFileUrl(relativePath: string): string {
  const encoded = relativePath
    .split("/")
    .filter((segment) => segment !== "")
    .map(encodeURIComponent)
    .join("/");
  return `${WORKSPACE_FILE_ROUTE}${encoded}`;
}

/** 작업공간이 연결돼 있는지 묻는 탐침(GET). 아래 "왜 탐침이 필요한가" 참고. */
export const WORKSPACE_STATUS_ROUTE = `${WORKSPACE_API_PREFIX}/status`;

/**
 * 응답이 **정말로 이 미들웨어가 준 것**임을 표시하는 헤더.
 *
 * `vite build` 결과물(개발 서버 없음)이나 정적 호스팅에서는 모르는 경로에 SPA 폴백이
 * 걸려 `index.html`이 200으로 돌아올 수 있다. 상태 코드만 보면 "작업공간이 있다"고
 * 오판하게 되므로, 클라이언트는 이 헤더까지 확인한다.
 */
export const WORKSPACE_MARKER_HEADER = "x-visual-spec-workspace";

/**
 * 읽기·쓰기가 허용되는 작업공간 하위 폴더와, 폴더별 허용 확장자.
 *
 * 화이트리스트다 — 여기 없는 폴더(`runtime`, `preview`)와 확장자는 전부 거부한다.
 * `.visual-spec/` 전체를 열지 않는 이유: 이 미들웨어는 브라우저에서 오는 요청을
 * 그대로 파일 입출력으로 바꾸므로, 열어둔 만큼이 그대로 공격면이다.
 *
 * - `specs`     — 화면 JSON 스펙. GUI의 Open/Save가 쓴다
 * - `assets`    — Import한 이미지. 이미지 확장자만 받는다
 * - `generated` — 생성된 React 코드. **이 작업은 쓸 수 있는 "경로를 여는 것"까지다**
 *                 (실제 코드 생성은 별도 작업). 하위 폴더(`pages/`, `components/`)를
 *                 쓰므로 중첩 경로를 허용한다
 */
export const WORKSPACE_DIR_RULES = {
  specs: [".json"],
  assets: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp", ".ico"],
  generated: [".tsx", ".ts", ".jsx", ".js", ".css", ".json", ".md"],
} as const;

export type WorkspaceDir = keyof typeof WORKSPACE_DIR_RULES;

/** 화면 JSON 스펙이 있는 폴더 — GUI의 Open/Save가 쓴다. */
export const SPEC_DIR: WorkspaceDir = "specs";

/** Import한 이미지가 들어가는 폴더. `ImageNode.src`의 `assets/...`가 이걸 가리킨다. */
export const ASSET_DIR: WorkspaceDir = "assets";

/** 화이트리스트에 있는 폴더 이름들. 미들웨어가 서버 시작 때 만들어 둔다. */
export const WORKSPACE_ACCESSIBLE_DIRS = Object.keys(WORKSPACE_DIR_RULES) as WorkspaceDir[];

export function isWorkspaceDir(value: string): value is WorkspaceDir {
  return Object.prototype.hasOwnProperty.call(WORKSPACE_DIR_RULES, value);
}

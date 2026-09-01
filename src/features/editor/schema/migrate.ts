import type { PageId, ProjectSpec, ScreenSpec, VisualSpec } from "./types";

/**
 * v0.1 문서를 넓힐 때 쓰는 페이지 id.
 * `screen.name`을 그대로 쓰지 않는 이유는 이름에 공백이나 한글이 들어갈 수 있는데
 * 페이지 id는 `^[A-Za-z0-9_-]+$`만 허용하기 때문이다.
 */
const FIRST_PAGE_ID: PageId = "page1";

/**
 * v0.1 문서를 페이지 1개짜리 프로젝트로 넓힌다.
 *
 * 버리는 정보가 없다. `toVisualSpec`으로 되돌리면 원본과 같아진다.
 * 기존 JSON 문서를 열 때 이 함수를 거치므로 v0.1 파일은 깨지지 않는다.
 */
export function migrateV01(spec: VisualSpec): ProjectSpec {
  return {
    version: "0.2",
    name: spec.screen.name,
    pages: { [FIRST_PAGE_ID]: spec.screen },
    pageOrder: [FIRST_PAGE_ID],
  };
}

/**
 * 페이지 하나를 v0.1 문서 모양으로 되돌린다.
 * Export "이 페이지만 내보내기"가 v0.1 계약대로 떨어지게 한다.
 */
export function toVisualSpec(page: ScreenSpec): VisualSpec {
  return { version: "0.1", screen: page };
}

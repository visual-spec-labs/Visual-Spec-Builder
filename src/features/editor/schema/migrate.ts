import type { PageId, ProjectSpec, ScreenSpec, VisualSpec } from "./types";

/**
 * 화면 문서를 넓힐 때 쓰는 페이지 id.
 * `screen.name`을 그대로 쓰지 않는 이유는 이름에 공백이나 한글이 들어갈 수 있는데
 * 페이지 id는 `^[A-Za-z0-9_-]+$`만 허용하기 때문이다.
 */
const FIRST_PAGE_ID: PageId = "page1";

/**
 * 화면 문서(`VisualSpec`)를 페이지 1개짜리 프로젝트로 넓힌다.
 *
 * 이름은 v0.1 시절 그대로지만(공개 API라 유지한다) 입출력은 둘 다 0.3이다 —
 * 0.1 파일은 입구(store/loadSpec.ts)에서 `migrateToV03`를 먼저 거친 뒤 여기 온다.
 * 버리는 정보가 없다. `toVisualSpec`으로 되돌리면 원본과 같아진다.
 */
export function migrateV01(spec: VisualSpec): ProjectSpec {
  return {
    version: "0.3",
    name: spec.screen.name,
    pages: { [FIRST_PAGE_ID]: spec.screen },
    pageOrder: [FIRST_PAGE_ID],
  };
}

/**
 * 페이지 하나를 화면 문서 모양으로 되돌린다.
 * Export "이 페이지만 내보내기"가 화면 문서 계약대로 떨어지게 한다. 버전은 0.3이다.
 */
export function toVisualSpec(page: ScreenSpec): VisualSpec {
  return { version: "0.3", screen: page };
}

/**
 * 0.1(화면)·0.2(프로젝트) 문서를 0.3으로 바꾼다(#127). 바깥에서 들어온 문서를
 * 검증하기 **전에** 부른다 — 변환 → 새 validator 순서다.
 *
 * 0.3이 바꾼 것은 `background` 모양 하나다. `{ color: c }`를
 * `[{ type: "solid", color: c }]`로 바꾸고 `version`을 "0.3"으로 올린다. 버리는
 * 정보가 없고 렌더 결과도 같다(docs/13-background-fill-design.md "마이그레이션과 버전").
 *
 * 입력이 `unknown`인 이유는 스키마가 바뀐 뒤에는 옛 모양의 생성 타입이 없기
 * 때문이다. 그래서 **아는 모양만 건드리고 나머지는 그대로 둔다** — 결과를 검증기가
 * 보고하게 하려는 것이다.
 * - 버전과 키가 짝이 맞는 문서만 바꾼다 — "0.1"이면 `screen`, "0.2"면 `pages`.
 *   짝이 안 맞는 문서는 옛 스키마로도 무효였으니 버전을 올려 유효하게 만들지 않는다.
 * - 이미 0.3이거나 버전이 다른 문서는 그대로 돌려준다. 0.3 문서에 남은
 *   `{ color }`는 고쳐 주지 않는다 — 새 모양으로 쓴다고 한 문서의 오류다.
 * - `background`는 "문자열 `color` 하나만 가진 객체"일 때만 바꾼다. 그 밖의 값
 *   (색이 숫자, 다른 칸이 섞임, 이미 배열 등)은 그대로 둔다.
 *
 * 입력을 고치지 않는다. 바뀌는 길만 얕게 복사한다.
 */
export function migrateToV03(input: unknown): unknown {
  if (!isRecord(input)) return input;

  if (input.version === "0.1" && "screen" in input) {
    return { ...input, version: "0.3", screen: migrateScreen(input.screen) };
  }

  if (input.version === "0.2" && "pages" in input) {
    const { pages } = input;
    return {
      ...input,
      version: "0.3",
      pages: isRecord(pages) ? mapValues(pages, migrateScreen) : pages,
    };
  }

  return input;
}

function migrateScreen(screen: unknown): unknown {
  if (!isRecord(screen) || !isRecord(screen.nodes)) return screen;
  return { ...screen, nodes: mapValues(screen.nodes, migrateNode) };
}

function migrateNode(node: unknown): unknown {
  if (!isRecord(node) || !("background" in node)) return node;

  const { background } = node;
  if (!isLegacyBackground(background)) return node;

  return { ...node, background: [{ type: "solid", color: background.color }] };
}

/** 0.1·0.2의 `Background` — 문자열 `color` 칸 하나뿐인 객체. */
function isLegacyBackground(value: unknown): value is { color: string } {
  return (
    isRecord(value) &&
    Object.keys(value).length === 1 &&
    typeof value.color === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapValues(
  record: Record<string, unknown>,
  map: (value: unknown) => unknown,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, map(value)]),
  );
}

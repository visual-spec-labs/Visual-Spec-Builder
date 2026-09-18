import type { Node } from "@/features/editor/schema";
import visualSpecJsonSchema from "@/features/editor/schema/visual-spec.schema.json";

/**
 * updateScreen·updateNode가 건드려도 되는 점 표기 경로인지 판정한다(#146).
 *
 * store/path.ts의 setByPath는 **없는 키를 새로 만들고** 중간 경로가 없으면 빈
 * 객체를 만들어 내려간다. 그래서 경로를 검사하지 않으면 오타 하나가 no-op이
 * 아니라 스키마에 없는 필드를 붙인 새 객체가 된다 — 새 객체라서 editorStore의
 * applied()가 no-op으로 못 보고 history에 한 단계로 쌓인다.
 *
 * 허용 목록은 손으로 적지 않고 정본 스키마(visual-spec.schema.json)를 걸어서
 * 만든다. 스키마의 객체가 전부 additionalProperties: false라 "스키마가 선언한
 * 속성"이 곧 "허용된 경로"이고, 스키마가 늘면 목록도 같이 늘어 둘이 어긋날 일이
 * 없다(손으로 적은 화이트리스트의 유일한 약점이 그거다).
 *
 * "지금 그 경로에 값이 있는지"(getByPath !== undefined)로 판정하지 않는 이유는
 * 선택 필드다. visible·background·border·shadow·opacity·blur는 스키마상 선택이라
 * 값이 없는 게 정상이고, 레이어 트리의 표시 토글과 속성 패널의 배경·효과 섹션이
 * 바로 그 "없던 필드를 처음 설정하는" 호출을 한다. 값 유무로 판정하면 그 기능들이
 * 통째로 막힌다.
 */

type JsonSchemaNode = {
  $ref?: string;
  oneOf?: JsonSchemaNode[];
  properties?: Record<string, JsonSchemaNode>;
};

const REF_PREFIX = "#/$defs/";

const schemaDefs = (visualSpecJsonSchema as unknown as {
  $defs: Record<string, JsonSchemaNode>;
}).$defs;

/**
 * 구조를 이루는 필드는 경로가 스키마에 있어도 updateScreen으로 바꾸지 않는다.
 * nodes·root를 통째로 갈아 끼우면 applyCreateNode·applyDeleteNode가 지키는 IR
 * 불변조건(root-missing·orphan-node)을 우회한다 — applyCommand의 계약이
 * "불변조건을 깨는 조합은 애초에 만들어지지 않게 막는다"이므로 여기서 막는다.
 * updateScreen이 원래 맡은 건 페이지 이름과 해상도뿐이다(command/types.ts).
 */
const SCREEN_STRUCTURAL_ROOTS: ReadonlySet<string> = new Set(["root", "nodes"]);

/**
 * 노드 쪽도 같은 이유다. children은 createNode·moveNode·deleteNode가 관리하고,
 * type을 바꾸면 남은 필드가 새 타입의 스키마와 어긋난 채로 남는다
 * (frame → text로 바꿔도 layout·children이 그대로 붙어 있다).
 */
const NODE_STRUCTURAL_ROOTS: ReadonlySet<string> = new Set(["type", "children"]);

const NODE_DEF_BY_TYPE: Record<Node["type"], string> = {
  frame: "FrameNode",
  text: "TextNode",
  image: "ImageNode",
  button: "ButtonNode",
  input: "InputNode",
};

interface ResolvedSchema {
  schema: JsonSchemaNode;
  /** 지금 가지에서 이미 지나온 $def 이름들. 순환 $ref가 생겨도 여기서 멈춘다. */
  visitedRefs: ReadonlySet<string>;
}

function resolveRef(
  schema: JsonSchemaNode,
  visitedRefs: ReadonlySet<string>,
): ResolvedSchema | undefined {
  const ref = schema.$ref;
  if (ref === undefined) return { schema, visitedRefs };
  if (!ref.startsWith(REF_PREFIX)) return undefined;

  const name = ref.slice(REF_PREFIX.length);
  if (visitedRefs.has(name)) return undefined;

  const target = schemaDefs[name];
  if (target === undefined) return undefined;

  return resolveRef(target, new Set([...visitedRefs, name]));
}

function collectPaths(
  schema: JsonSchemaNode,
  prefix: string,
  visitedRefs: ReadonlySet<string>,
  out: Set<string>,
): void {
  const resolved = resolveRef(schema, visitedRefs);
  if (resolved === undefined) return;

  const { oneOf, properties } = resolved.schema;

  // 어느 분기로도 쓸 수 있으니 분기별 경로의 합집합을 받는다
  // (Radius: 숫자 하나이거나 모서리별 객체).
  if (oneOf !== undefined) {
    for (const branch of oneOf) {
      collectPaths(branch, prefix, resolved.visitedRefs, out);
    }
    return;
  }

  // properties가 없으면 더 내려갈 곳이 없다 — 배열(children)과 키가 자유로운
  // 맵(nodes)이 여기에 해당한다. 둘 다 점 표기 경로로 들어갈 대상이 아니다.
  if (properties === undefined) return;

  for (const [key, child] of Object.entries(properties)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    out.add(path);
    collectPaths(child, path, resolved.visitedRefs, out);
  }
}

function buildEditablePaths(
  defName: string,
  structuralRoots: ReadonlySet<string>,
): ReadonlySet<string> {
  const collected = new Set<string>();
  collectPaths({ $ref: `${REF_PREFIX}${defName}` }, "", new Set(), collected);

  return new Set(
    [...collected].filter((path) => !structuralRoots.has(path.split(".")[0])),
  );
}

// 스키마는 실행 중에 바뀌지 않으므로 한 번만 걷는다.
let screenPaths: ReadonlySet<string> | undefined;
const nodePathsByType = new Map<Node["type"], ReadonlySet<string>>();

/** ScreenSpec 자신의 편집 가능한 경로인지. "name" · "size.width" 등. */
export function isEditableScreenPath(path: string): boolean {
  screenPaths ??= buildEditablePaths("ScreenSpec", SCREEN_STRUCTURAL_ROOTS);
  return screenPaths.has(path);
}

/**
 * 해당 타입의 노드가 편집 가능한 경로인지. 타입별로 따로 본다 —
 * "layout.gap"은 frame에만 있고 text 노드에는 없다.
 */
export function isEditableNodePath(nodeType: Node["type"], path: string): boolean {
  let paths = nodePathsByType.get(nodeType);
  if (paths === undefined) {
    paths = buildEditablePaths(NODE_DEF_BY_TYPE[nodeType], NODE_STRUCTURAL_ROOTS);
    nodePathsByType.set(nodeType, paths);
  }

  return paths.has(path);
}

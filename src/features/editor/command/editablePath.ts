import type { Node, ScreenSpec } from "@/features/editor/schema";
import visualSpecJsonSchema from "@/features/editor/schema/visual-spec.schema.json";

/**
 * updateScreen·updateNode가 건드려도 되는 점 표기 경로인지 판정한다(#146).
 *
 * store/path.ts의 setByPath는 **없는 키를 새로 만들고** 중간 값이 객체가 아니면
 * 빈 객체를 만들어 내려간다. 그래서 경로를 검사하지 않으면 오타 하나가 no-op이
 * 아니라 스키마에 없는 필드를 붙인 새 객체가 된다 — 새 객체라서 editorStore의
 * applied()가 no-op으로 못 보고 history에 한 단계로 쌓인다.
 *
 * 판정 기준은 정본 스키마(visual-spec.schema.json)다. 손으로 화이트리스트를 적지
 * 않는다 — 스키마의 객체가 전부 additionalProperties: false라 "스키마가 선언한
 * 속성"이 곧 "허용된 경로"이고, 스키마가 늘면 판정도 같이 늘어 둘이 어긋날 일이
 * 없다.
 *
 * **다만 경로 이름만 봐서는 부족하다**(PR #147 리뷰). 스키마 구조만 걷고 지금 값을
 * 보지 않으면 "이름이 맞는 경로"가 "지금 값 위에 써도 되는 경로"와 어긋난다:
 *
 * - `border`가 없는 노드에 `border.width = 3`을 쓰면 `{ width: 3 }`만 생겨
 *   필수 `color`·`radius`가 빠진다.
 * - `border.radius`가 숫자 `12`인 노드에 `border.radius.topLeft = 4`를 쓰면
 *   `{ topLeft: 4 }`가 되어 나머지 필수 모서리 세 개가 빠진다.
 *
 * 둘 다 새 screen 참조가 나와 history에 성공 단계로 쌓이지만 결과는 스키마 검증에
 * 실패한다 — #146이 잡으려던 "조용한 오염"의 다른 형태다. 그래서 스키마와 **지금
 * 값을 함께** 걷는다: 중간 값이 이미 객체면 형제 필드가 보존되므로 그대로 내려가고,
 * 객체가 아니면(없거나 · 유니온의 비객체 분기거나) setByPath가 새로 만들 객체가
 * 그 키 하나만 갖게 되므로 **그 분기의 필수 필드가 그 키 하나뿐일 때만** 허용한다.
 *
 * "지금 그 경로에 값이 있는지"만으로 막지 않는 이유는 선택 필드다.
 * visible·background·border·shadow·opacity·blur는 스키마상 선택이라 값이 없는 게
 * 정상이고, 레이어 트리의 표시 토글과 속성 패널의 배경 섹션이 바로 그 "없던 필드를
 * 처음 설정하는" 호출을 한다. 값 유무만으로 판정하면 그 기능들이 통째로 막힌다.
 * 위의 필수 필드 조건이 그 둘을 가른다 — Background는 필수가 `color` 하나라
 * `background.color`가 없던 배경을 새로 만들어도 결과가 완전하지만, Border는 필수가
 * 셋이라 `border.width` 하나로는 완전해지지 않는다.
 *
 * 그래서 리뷰가 제시한 두 방향 중 (가) 값을 함께 보는 쪽을 골랐다. (나) "복합
 * optional/union 필드는 객체 통째로만 교체"는 `background.color`를 같이 막는데,
 * 그 경로는 ui/properties/BackgroundSection.tsx가 실제로 쓰는 정상 호출이다.
 * border·radius·shadow를 객체 통째로 patch하는 건 ui 쪽(borderPatch·radiusPatch·
 * shadowPatch)이 이미 하고 있으므로, 여기서는 "완전해지지 않는 쓰기"만 막으면 된다.
 */

type JsonSchemaNode = {
  $ref?: string;
  oneOf?: JsonSchemaNode[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
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

/** store/path.ts의 setByPath가 "내려갈 수 있는 값"으로 보는 것과 같은 기준이다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 스키마가 **자기 것으로** 선언한 속성만 꺼낸다.
 * `properties[key]`로 바로 읽으면 "__proto__"·"constructor"·"toString"이
 * Object.prototype의 것을 집어 스키마에 있는 키처럼 보인다 — 막으려던 오염 경로가
 * 그대로 뚫린다.
 */
function ownProperty(
  properties: Record<string, JsonSchemaNode> | undefined,
  key: string,
): JsonSchemaNode | undefined {
  if (properties === undefined) return undefined;
  return Object.prototype.hasOwnProperty.call(properties, key)
    ? properties[key]
    : undefined;
}

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

  const target = ownProperty(schemaDefs, name);
  if (target === undefined) return undefined;

  return resolveRef(target, new Set([...visitedRefs, name]));
}

/**
 * `segments`가 가리키는 자리에 setByPath로 값을 써도, 지나는 모든 단계가 스키마를
 * 만족한 채로 남는가. `value`는 그 단계의 **지금 값**이다(없으면 undefined).
 */
function canWrite(
  schema: JsonSchemaNode,
  value: unknown,
  segments: readonly string[],
  visitedRefs: ReadonlySet<string>,
): boolean {
  const resolved = resolveRef(schema, visitedRefs);
  if (resolved === undefined) return false;

  const { oneOf, properties, required } = resolved.schema;

  // 유니온은 분기별 경로를 합집합으로 받지 않는다. "지금 값 위에서 성립하는 분기가
  // 하나라도 있는가"로 본다 — 분기마다 아래 필수 필드 검사를 다시 거치므로,
  // Radius가 숫자 12일 때 모서리별 객체 분기로 내려가는 길은 여기서 닫힌다.
  if (oneOf !== undefined) {
    return oneOf.some((branch) =>
      canWrite(branch, value, segments, resolved.visitedRefs),
    );
  }

  // properties가 없으면 더 내려갈 곳이 없다 — 스칼라, 배열(children), 키가 자유로운
  // 맵(nodes)이 여기에 해당한다. 셋 다 점 표기 경로로 들어갈 대상이 아니다.
  const [key, ...rest] = segments;
  const child = ownProperty(properties, key);
  if (child === undefined) return false;

  // 지금 값이 객체가 아니면 setByPath가 `{}`를 새로 만들어 내려간다. 그러면 이
  // 단계의 결과는 `key` 하나만 든 객체라, 필수 필드가 `key` 하나뿐일 때만 스키마를
  // 만족한다. Background(필수 color 하나)는 통과하고 Border(width·color·radius)와
  // Radius의 객체 분기(모서리 넷)는 막힌다.
  // 값이 이미 객체면 형제 필드가 그대로 보존되므로 검사할 게 없다.
  if (!isRecord(value) && (required ?? []).some((name) => name !== key)) {
    return false;
  }

  if (rest.length === 0) return true;

  return canWrite(
    child,
    isRecord(value) ? value[key] : undefined,
    rest,
    resolved.visitedRefs,
  );
}

function isEditablePath(
  defName: string,
  structuralRoots: ReadonlySet<string>,
  target: unknown,
  path: string,
): boolean {
  const segments = path.split(".");
  if (structuralRoots.has(segments[0])) return false;

  return canWrite({ $ref: `${REF_PREFIX}${defName}` }, target, segments, new Set());
}

/**
 * 이 화면에 이 경로로 값을 써도 되는지. "name" · "size.width" 등.
 * 판정에 화면의 지금 값을 함께 쓴다 — 이유는 파일 머리말 참고.
 */
export function isEditableScreenPath(screen: ScreenSpec, path: string): boolean {
  return isEditablePath("ScreenSpec", SCREEN_STRUCTURAL_ROOTS, screen, path);
}

/**
 * 이 노드에 이 경로로 값을 써도 되는지.
 *
 * 노드 타입을 함께 본다 — "layout.gap"은 frame에만 있고 text 노드에는 없다.
 * 타입만이 아니라 노드의 지금 값도 본다 — 같은 "border.radius.topLeft"라도
 * radius가 이미 모서리별 객체면 허용하고, 숫자 하나면 막는다.
 */
export function isEditableNodePath(node: Node, path: string): boolean {
  return isEditablePath(
    NODE_DEF_BY_TYPE[node.type],
    NODE_STRUCTURAL_ROOTS,
    node,
    path,
  );
}

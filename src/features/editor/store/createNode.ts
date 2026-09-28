import type {
  ButtonNode,
  FrameNode,
  ImageNode,
  InputNode,
  Radius,
  Shadow,
  TextNode,
} from "@/features/editor/schema";

/**
 * 스키마가 정의한 노드 타입 5종 전부. 예전엔 도구 모음이 만들 수 있는
 * frame·text만 있었지만(#182), 자연어 기본값 채우기 계층(docs/08-natural-language.md
 * 3.2)이 나머지 image·button·input도 이 함수로 채우게 되면서 넓어졌다.
 */
export type NodeKind = "frame" | "text" | "image" | "button" | "input";

type NodeByKind = {
  frame: FrameNode;
  text: TextNode;
  image: ImageNode;
  button: ButtonNode;
  input: InputNode;
};

/**
 * 06-schema-freeze.md가 "객체를 통째로 받는 선택 필드는 내부 칸을 모두
 * 필수로 둔다"고 정한 타입들. Radius의 객체 변형(모서리 4칸)과 Shadow가
 * 여기 해당한다 — 한쪽만 채운 반쪽 객체는 그 필드 전체를 깨뜨리므로
 * (types.ts의 Radius 설명 참고) DeepPartial이 안까지 파고들면 안 된다.
 */
type Atomic = Radius | Shadow;

/**
 * T를 재귀적으로 부분화한다. 배열은 통째로 교체 대상이라 원소 단위로 파고들지
 * 않는다 — children처럼 부분 병합이 의미 없는 필드가 이 규칙을 따른다.
 * Atomic 타입도 통째로 교체 대상이다 — 부분 값을 허용하면 deepMerge가
 * 기본값과 병합하지 못했을 때(기본값이 없거나 다른 union 변형일 때)
 * 필수 칸이 빠진 객체를 그대로 통과시키게 된다.
 */
type DeepPartial<T> = T extends Atomic
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

/**
 * kind별 부분 덮어쓰기 값. `type`은 kind가 이미 정하므로 여기서는 받지 않는다.
 */
export type NodeOverrides<K extends NodeKind> = DeepPartial<Omit<NodeByKind[K], "type">>;

/**
 * 새 프레임의 기본 스타일.
 * docs/04-gui-spec.md가 "Frame 기본 스타일 미확정"으로 남겨 둔 항목이라,
 * 시드 스펙(seedSpec)의 카드와 같은 톤에서 가장 단순한 값을 골랐다.
 *
 * 크기를 고정값으로 두는 점만 레이어 트리의 "레이어 추가"(auto·auto)와 다르다.
 * 트리에서 만든 프레임은 목록에 줄이 하나 생겨 바로 보이지만, 캔버스에서 만든
 * 프레임이 0×0이면 클릭했는데 아무 일도 없는 것처럼 보이기 때문이다.
 */
function newFrame(): FrameNode {
  return {
    type: "frame",
    name: "Frame",
    box: { width: 200, height: 120 },
    layout: {
      direction: "column",
      gap: 8,
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
      mainAxis: "start",
      crossAxis: "start",
    },
    background: { color: "#FFFFFF" },
    border: { width: 1, color: "#E5E7EB", radius: 8 },
    children: [],
  };
}

function newText(): TextNode {
  return {
    type: "text",
    name: "Text",
    box: { width: "auto", height: "auto" },
    content: "텍스트",
    color: "#111111",
    typography: {
      fontFamily: "Pretendard",
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 24,
      letterSpacing: 0,
      textAlign: "left",
    },
  };
}

/**
 * 새 이미지의 기본값. src는 워크스페이스 asset이 없어도 항상 유효하도록
 * 1×1 투명 PNG data URI를 쓴다 — "assets/..." 상대 경로를 기본값으로 두면
 * 실제 파일이 없는 워크스페이스에서는 깨진 참조가 된다(스키마는 비지 않은
 * 문자열만 요구할 뿐 존재를 확인하지 않는다, schema/types.ts의 ImageNode 참고).
 */
function newImage(): ImageNode {
  return {
    type: "image",
    name: "Image",
    box: { width: 200, height: 150 },
    src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    fit: "cover",
  };
}

/** 새 버튼의 기본 스타일. examples/form-grid.json의 SubmitButton과 같은 톤. */
function newButton(): ButtonNode {
  return {
    type: "button",
    name: "Button",
    box: { width: 120, height: 40 },
    content: "버튼",
    color: "#FFFFFF",
    typography: {
      fontFamily: "Pretendard",
      fontSize: 14,
      fontWeight: 600,
      lineHeight: 20,
      letterSpacing: 0,
      textAlign: "center",
    },
    background: { color: "#4F46E5" },
    border: { width: 0, color: "#4F46E5", radius: 8 },
  };
}

/** 새 입력창의 기본 스타일. examples/form-grid.json의 NameInput과 같은 톤. */
function newInput(): InputNode {
  return {
    type: "input",
    name: "Input",
    box: { width: 200, height: 44 },
    placeholder: "입력하세요",
    color: "#111827",
    typography: {
      fontFamily: "Pretendard",
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 20,
      letterSpacing: 0,
      textAlign: "left",
    },
    background: { color: "#F9FAFB" },
    border: { width: 1, color: "#D1D5DB", radius: 8 },
  };
}

const factories: { [K in NodeKind]: () => NodeByKind[K] } = {
  frame: newFrame,
  text: newText,
  image: newImage,
  button: newButton,
  input: newInput,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * base에 overrides를 재귀적으로 얹는다. 두 쪽 다 plain object인 칸만 파고들고
 * 병합한다 — 그 외(배열, 원시값, "auto"/"fill" 같은 union 대표값)는 overrides
 * 쪽 값이 통째로 이긴다. base는 건드리지 않는다.
 *
 * `undefined`인 칸은 "안 줬다"로 본다 — TS는 옵셔널(`?`) 칸에 명시적으로
 * `undefined`를 넣는 걸 허용하는데, 그걸 그대로 덮으면 `name` 같은 필수
 * 문자열 필드가 `undefined`로 지워질 수 있다.
 */
function deepMerge<T extends Record<string, unknown>>(
  base: T,
  overrides: Record<string, unknown>,
): T {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(overrides)) {
    const overrideValue = overrides[key];
    if (overrideValue === undefined) continue;

    const baseValue = result[key];

    result[key] =
      isPlainObject(overrideValue) && isPlainObject(baseValue)
        ? deepMerge(baseValue, overrideValue)
        : overrideValue;
  }

  return result as T;
}

/**
 * 노드를 만든다. id는 붙이지 않는다 — 그건 store/nodeId.ts의 generateNodeId가
 * 이미 하는 일이다. 스토어도, 파일 IO도, 에이전트 통로도 건드리지 않는 순수
 * 함수라 결과를 그대로 검증기에 넣어 테스트할 수 있다.
 *
 * overrides는 일부 칸만 채워도 된다 — 나머지는 kind별 기본값이 채운다
 * (docs/08-natural-language.md 3.2 "기본값 채우기 계층"). 중첩 객체(box·layout·
 * typography·background·border)는 칸 단위로 병합되고, 배열(children 등)과
 * union 대표값(Size·Radius 등)은 통째로 교체된다. overrides를 생략하면 기존
 * 도구 모음이 쓰던 것과 같은 완전한 기본 노드를 돌려준다.
 */
export function createNode<K extends NodeKind>(
  kind: K,
  overrides?: NodeOverrides<K>,
): NodeByKind[K] {
  const base = factories[kind]();
  if (!overrides) return base;

  return deepMerge(
    base as unknown as Record<string, unknown>,
    overrides as Record<string, unknown>,
  ) as unknown as NodeByKind[K];
}

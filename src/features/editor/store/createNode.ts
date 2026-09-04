import type { FrameNode, Node, TextNode } from "@/features/editor/schema";

/**
 * 하단 도구 모음이 만들 수 있는 노드 종류.
 * 스키마의 노드 타입 전체가 아니다 — Image·Shape 도구는 MVP 제외이고
 * (docs/02-mvp-scope.md), Button·Input은 아직 도구가 없다.
 */
export type NodeKind = "frame" | "text";

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
 * 도구가 추가할 새 노드를 만든다. id는 붙이지 않는다 — 그건 store/nodeId.ts의
 * generateNodeId가 이미 하는 일이다. 스토어를 건드리지 않는 순수 함수라
 * 결과를 그대로 검증기에 넣어 테스트할 수 있다.
 */
export function createNode(kind: NodeKind): Node {
  return kind === "frame" ? newFrame() : newText();
}

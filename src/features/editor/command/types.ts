import type { Layout, Node, NodeId } from "@/features/editor/schema";

/**
 * GUI 이벤트와 자연어 Agent가 공유하는 편집 명령(PRD 1차 11·16장,
 * component-architecture.md §3.3 vsb-command-engine). 노드 5종 + 페이지 1종.
 *
 * 둘 다 IR(ScreenSpec)을 직접 건드리지 않고 이 Command만 만든다 — 만든
 * Command를 실제로 적용하는 건 applyCommand뿐이다. 드래그로 옮기든
 * "버튼을 오른쪽으로 옮겨줘"라고 하든 같은 moveNode Command가 나와야 한다는
 * 게 이 타입의 존재 이유다.
 *
 * #73에서는 이 타입과 applyCommand/history만 만들고 editorStore를 이걸
 * 쓰도록 바꾸는 건 범위 밖으로 남겨뒀다(EDITOR_STORE_CONTRACT.md가
 * setNodeField를 팀 계약으로 못박아뒀어서). #40에서 setNodeField·setPageField의
 * 내부 구현을 이 Command/applyCommand 위로 옮겼다 — 시그니처는 그대로라
 * 호출부(패널·트리)는 바뀐 걸 모른다. docs/EDITOR_STORE_CONTRACT.md 참고.
 */
export type Command =
  | CreateNodeCommand
  | UpdateNodeCommand
  | DeleteNodeCommand
  | MoveNodeCommand
  | SetLayoutCommand
  | UpdateScreenCommand;

export interface CreateNodeCommand {
  type: "createNode";
  /** 새 노드를 자식으로 넣을 frame. */
  parentId: NodeId;
  id: NodeId;
  node: Node;
}

export interface UpdateNodeCommand {
  type: "updateNode";
  id: NodeId;
  /** 점 표기 경로. store/path.ts의 setByPath와 같은 규칙("layout.gap" 등). */
  path: string;
  value: unknown;
}

export interface DeleteNodeCommand {
  type: "deleteNode";
  id: NodeId;
}

export interface MoveNodeCommand {
  type: "moveNode";
  id: NodeId;
  /** 옮겨갈 부모 frame. */
  newParentId: NodeId;
  /** newParentId의 children에서 삽입할 위치. */
  index: number;
}

export interface SetLayoutCommand {
  type: "setLayout";
  /** frame 노드만 대상이다 — text/image/button/input은 layout이 없다. */
  id: NodeId;
  layout: Layout;
}

/**
 * 노드가 아니라 화면(ScreenSpec) 자신의 필드를 바꾼다 — 페이지 이름 · 해상도(size).
 * updateNode와 대상만 다르고 나머지 규칙은 같다: 점 표기 경로, setByPath로 불변 갱신.
 */
export interface UpdateScreenCommand {
  type: "updateScreen";
  /** 점 표기 경로. "name", "size.width" 등. */
  path: string;
  value: unknown;
}

/**
 * 자연어 요청 하나 또는 GUI 조작 하나가 낳는 Command 묶음.
 * PRD 13장: "AI가 한 요청으로 여러 노드를 수정했다면 그 요청 전체를
 * 하나의 트랜잭션으로 묶는다." history.pushHistory를 트랜잭션당 한 번만
 * 부르면 이 묶음 전체가 Undo 한 번에 되돌아간다.
 */
export interface Transaction {
  commands: Command[];
}

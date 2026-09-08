import type { Layout, Node, NodeId } from "@/features/editor/schema";

/**
 * GUI 이벤트와 자연어 Agent가 공유하는 편집 명령 5종(PRD 1차 11·16장,
 * component-architecture.md §3.3 vsb-command-engine).
 *
 * 둘 다 IR(VisualSpec)을 직접 건드리지 않고 이 Command만 만든다 — 만든
 * Command를 실제로 적용하는 건 applyCommand뿐이다. 드래그로 옮기든
 * "버튼을 오른쪽으로 옮겨줘"라고 하든 같은 moveNode Command가 나와야 한다는
 * 게 이 타입의 존재 이유다.
 *
 * 지금은 이 타입과 applyCommand/history만 만든다 — editorStore를
 * 이걸 쓰도록 바꾸는 건 범위 밖이다(#73 논의 참고. EDITOR_STORE_CONTRACT.md가
 * setNodeField를 이미 팀 계약으로 못박아뒀고, 그걸 갈아끼우는 건 이
 * PR의 판단을 넘어선다).
 */
export type Command =
  | CreateNodeCommand
  | UpdateNodeCommand
  | DeleteNodeCommand
  | MoveNodeCommand
  | SetLayoutCommand;

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
  /** frame 노드만 대상이다 — text/image는 layout이 없다. */
  id: NodeId;
  layout: Layout;
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

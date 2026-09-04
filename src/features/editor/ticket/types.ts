import type { NodeId } from "@/features/editor/schema";

/**
 * Visual Spec IR을 컴포넌트 구현 작업 단위로 쪼갠 것(PRD 1차 14장, "화면 생성과
 * 코드 생성은 분리된다" — Ticket Compiler). 지금까지는 이 개념이
 * `skills/visual-spec-to-react/SKILL.md`의 "컴포넌트 단위로 분리 생성한다" 절에
 * 자연어 지시문으로만 있었다. 여기서 그 규칙을 코드로 옮긴다 — 새 규칙을
 * 만드는 게 아니라 이미 있던 규칙을 형식화하는 것이다.
 */
export type TicketStatus = "pending" | "in-progress" | "done" | "failed";

export interface Ticket {
  /** 같은 compileTickets 호출 안에서 고유하다. 컴포넌트 이름과 같다(PascalCase). */
  id: string;
  componentName: string;
  /**
   * "page" = screen.root가 만드는 티켓(화면 전체를 조합하는 최상위 컴포넌트).
   * "component" = root의 직계 자식, 또는 반복되는 형제 그룹에서 뽑힌 컴포넌트.
   */
  kind: "page" | "component";
  /**
   * 이 컴포넌트가 실제로 대표하는 노드들. 보통 1개다. 반복 컴포넌트(같은 모양
   * 형제가 여럿)면 그 형제 노드 id 전부가 들어간다 — 컴포넌트 파일은 하나,
   * 호출은 인스턴스 수만큼.
   */
  instances: NodeId[];
  /** 이 티켓을 만들기 전에 먼저 끝나 있어야 하는 티켓 id들. */
  dependsOn: string[];
  status: TicketStatus;
}

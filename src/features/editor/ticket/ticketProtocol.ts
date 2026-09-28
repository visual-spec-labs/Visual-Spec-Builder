/**
 * GUI ↔ 외부 에이전트가 주고받는 **티켓 실행** 요청/응답의 형식 계약 (이슈 #184).
 *
 * #156의 A안(계획·상태 표시만)을 B안으로 넓히는 작업이다. #155(PR #177)가 이미
 * `.visual-spec/runtime/`에 요청을 쓰고 에이전트가 응답을 쓰는 파일 교환 통로를
 * 만들어 뒀다 — `editor/nl/nlProtocol.ts`가 그 통로의 자연어 편집 쪽 형식이고, 이
 * 파일은 같은 통로를 티켓 실행에 재사용한 **티켓 실행 쪽 형식**이다. 새 라우트도
 * 새 폴더도 만들지 않는다. `runtime` 디렉터리는 이미 `.json`만 받는 화이트리스트
 * 항목이다(`workspace/protocol.ts`).
 *
 * ## 자연어 경로와 다른 점
 *
 * `nlProtocol.ts`의 응답은 Command 배열이라 G1(`validateTransaction`)을 통과시켜야
 * `editorStore.applyGuardedTransaction`에 넘길 수 있다. 티켓 실행은 Command를 만들지
 * 않는다 — 에이전트가 `.visual-spec/generated/pages|components/*.tsx`를 직접 쓴다
 * (`skills/visual-spec-to-react/SKILL.md`의 고정 경로). 그래서 응답은 "이 티켓들이
 * 각각 끝났는지 실패했는지"라는 상태 보고일 뿐이고, 그 결과로 실제 파일이 맞게
 * 생겼는지는 이 파일이 아니라 `export/verifyGenerated.ts`(#157)가 검증한다 — 여기서
 * 다시 훑지 않는다.
 *
 * ## 핸드셰이크
 *
 * ```
 * GUI                                     에이전트
 *  │ PUT runtime/ticket-request.json ──▶   (읽는다)
 *  │                                        각 티켓의 filePath에 코드를 쓴다
 *  │ GET runtime/ticket-response.json ◀──  PUT runtime/ticket-response.json
 *  │   requestId가 같아질 때까지 폴링
 *  ▼
 * ticketStatus.applyTicketResults → ticketStore.tickets 갱신 → (전체 실행이면) 다음 웨이브
 * ```
 *
 * 요청은 한 번에 여러 티켓을 실어 보낼 수 있다 — `dependsOn`이 전부 `"done"`인
 * "준비된 티켓들"(`ticketStatus.readyTickets`) 한 웨이브가 단위다. 응답도 그 웨이브
 * 전체에 대한 결과 배열 하나다 — `skills/visual-spec-to-react/SKILL.md`의 "여러
 * 화면을 한 번에 처리한다"(배치 원칙, 하나가 실패해도 나머지는 계속)와 같은 단위다.
 *
 * ## 이 파일이 신뢰하지 않는 것
 *
 * 응답 JSON은 바깥에서 온 값이다. `parseTicketResponse`는 어떤 모양이 와도 예외를
 * 던지지 않고 판정만 돌려준다(`nlProtocol.parseNlResponse`와 같은 원칙).
 */

import type { NodeId, PageId, ScreenSpec } from "@/features/editor/schema";
import { ticketFilePath } from "@/features/editor/export/generatedPaths";
import type { Ticket, TicketStatus } from "@/features/editor/ticket/types";
import { RUNTIME_DIR } from "@/features/workspace/protocol";

/**
 * 요청/응답 JSON에 함께 실리는 형식 버전. `nlProtocol.NL_PROTOCOL_VERSION`과 같은
 * 이유로 둔다 — 에이전트 쪽 구현이 GUI보다 오래된 규약을 들고 있을 수 있다.
 */
export const TICKET_PROTOCOL_VERSION = 1;

/** GUI가 쓰는 요청 파일(작업공간 루트 기준 상대 경로). */
export const TICKET_REQUEST_PATH = `${RUNTIME_DIR}/ticket-request.json`;

/** 응답 파일 이름. 목록 라우트가 돌려주는 값과 맞춰 보는 데 쓴다(`ticketAgentClient.ts`). */
export const TICKET_RESPONSE_FILE = "ticket-response.json";

/** 에이전트가 쓰는 응답 파일. GUI가 이 파일을 폴링한다. */
export const TICKET_RESPONSE_PATH = `${RUNTIME_DIR}/${TICKET_RESPONSE_FILE}`;

/** 요청에 실리는 티켓 하나. 에이전트가 이 정보만으로 파일을 어디에 써야 하는지 안다. */
export interface TicketRequestItem {
  id: string;
  componentName: string;
  kind: "page" | "component";
  instances: NodeId[];
  /** `.visual-spec/generated/` 기준 상대 경로. `export/generatedPaths.ticketFilePath`가 정한다. */
  filePath: string;
}

export interface TicketRequest {
  protocol: number;
  /** 이 요청(웨이브)의 식별자. 응답의 `requestId`와 같아야 짝으로 인정한다. */
  id: string;
  /** 대상 페이지. 1차는 활성 페이지 한 장뿐이다(nlProtocol과 같은 제약). */
  pageId: PageId;
  /** 대상 페이지의 현재 스펙 전체. 에이전트가 노드 구조를 여기서 읽는다. */
  page: ScreenSpec;
  /** 이번 웨이브에 포함된 티켓들 — 의존성이 이미 끝난 것들만 온다. */
  tickets: TicketRequestItem[];
  /** 에이전트가 답을 써야 하는 자리. 규약을 문서 밖에서도 알 수 있게 실어 보낸다. */
  responsePath: string;
}

export interface BuildTicketRequestInput {
  id: string;
  pageId: PageId;
  page: ScreenSpec;
  tickets: Ticket[];
}

/** 요청 파일에 쓸 객체를 만든다. 순수 함수 — 파일을 쓰지 않는다. */
export function buildTicketRequest(input: BuildTicketRequestInput): TicketRequest {
  return {
    protocol: TICKET_PROTOCOL_VERSION,
    id: input.id,
    pageId: input.pageId,
    page: input.page,
    tickets: input.tickets.map((ticket) => ({
      id: ticket.id,
      componentName: ticket.componentName,
      kind: ticket.kind,
      instances: ticket.instances,
      filePath: ticketFilePath(ticket),
    })),
    responsePath: TICKET_RESPONSE_PATH,
  };
}

/** 티켓 하나에 대한 실행 결과. `done`이면 `message`는 없어도 된다. */
export interface TicketResultItem {
  ticketId: string;
  status: Extract<TicketStatus, "done" | "failed">;
  /** `status`가 `"failed"`일 때 사람이 읽을 실패 사유. */
  message?: string;
}

/**
 * 응답 판정.
 *
 * - `stale` — 아직 이번 요청(웨이브)의 답이 아니다. 호출부는 계속 기다린다.
 * - `malformed` — JSON이 아니거나 모양이 규약과 다르다.
 * - `results` — 통과. `ticketStatus.applyTicketResults`로 넘긴다.
 */
export type TicketResponseResult =
  | { kind: "stale" }
  | { kind: "malformed"; message: string }
  | { kind: "results"; results: TicketResultItem[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTicketResultItem(value: unknown): value is TicketResultItem {
  if (!isRecord(value)) return false;
  if (typeof value.ticketId !== "string" || value.ticketId === "") return false;
  if (value.status !== "done" && value.status !== "failed") return false;
  if (value.message !== undefined && typeof value.message !== "string") return false;
  return true;
}

/**
 * 응답 파일 본문을 판정한다. **절대 예외를 던지지 않는다** — `nlProtocol.parseNlResponse`와
 * 같은 이유다.
 *
 * `text`가 null이면(파일이 아직 없다) `stale`이다.
 */
export function parseTicketResponse(
  text: string | null,
  requestId: string,
): TicketResponseResult {
  if (text === null) return { kind: "stale" };

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { kind: "malformed", message: "응답 파일이 올바른 JSON이 아닙니다." };
  }

  if (!isRecord(body)) {
    return { kind: "malformed", message: "응답이 객체가 아닙니다." };
  }

  // requestId를 가장 먼저 본다 — 낡은 응답에 담긴 실패를 이번 요청의 실패로 보여주지 않는다.
  if (body.requestId !== requestId) return { kind: "stale" };

  if (body.protocol !== TICKET_PROTOCOL_VERSION) {
    return {
      kind: "malformed",
      message: `응답 형식 버전이 다릅니다(기대: ${TICKET_PROTOCOL_VERSION}, 받음: ${JSON.stringify(body.protocol)}).`,
    };
  }

  if (!Array.isArray(body.results)) {
    return { kind: "malformed", message: "응답에 results 배열이 없습니다." };
  }

  if (!body.results.every(isTicketResultItem)) {
    return { kind: "malformed", message: "results 항목 모양이 규약과 다릅니다." };
  }

  return { kind: "results", results: body.results };
}

/**
 * 티켓 실행 요청을 `.visual-spec/runtime/`에 내려놓고 에이전트의 응답을 기다리는
 * 브라우저 쪽 절반 (이슈 #184).
 *
 * `editor/nl/nlAgentClient.ts`와 같은 골격이다 — 반대편 절반은 사람이 켜 둔
 * 에이전트고, 앱은 LLM을 부르지 않는다. 다만 그 파일을 import하지 않고 이 파일
 * 하나로 완결시킨다: 이슈 범위가 "자연어 통로는 본뜨되 고치지 않는다"이므로,
 * 거기 의존까지 만들면 그 파일이 바뀔 때 여기가 조용히 함께 흔들릴 여지가 생긴다.
 *
 * 파일 입출력은 이미 있는 얇은 클라이언트(`ui/workspaceClient.ts`)를 그대로 쓴다 —
 * 작업공간이 없을 때 조용히 `null`로 떨어지는 동작까지 같이 물려받는다.
 *
 * **폴링인 이유.** `nlAgentClient.ts` 머리말과 같다 — 미들웨어에는 파일 변경을
 * 알려주는 통로가 없고, SSE·WebSocket을 새로 여는 것은 #133이 좁혀 둔 공격면을
 * 다시 넓히는 일이다.
 */

import {
  listWorkspaceFiles,
  readWorkspaceTextFile,
  writeWorkspaceFile,
} from "@/features/editor/ui/workspaceClient";
import { RUNTIME_DIR } from "@/features/workspace/protocol";

import {
  buildTicketRequest,
  parseTicketResponse,
  TICKET_REQUEST_PATH,
  TICKET_RESPONSE_PATH,
  TICKET_RESPONSE_FILE,
  type BuildTicketRequestInput,
  type TicketResponseResult,
} from "./ticketProtocol";

/** 응답을 확인하는 간격. `nlAgentClient.NL_POLL_INTERVAL_MS`와 같은 값이다. */
export const TICKET_POLL_INTERVAL_MS = 1000;

/**
 * 기다리기를 포기하는 시각. 3분이다 — `nlAgentClient.NL_TIMEOUT_MS`와 같은 근거
 * (사람이 에이전트에 요청을 옮기는 시간이 끼는 경로).
 */
export const TICKET_TIMEOUT_MS = 180_000;

export type TicketBatchOutcome =
  | { kind: "unavailable"; message: string }
  | { kind: "writeFailed"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "cancelled" }
  | { kind: "response"; result: TicketResponseResult };

/** 취소 신호. 호출부(ticketStore)가 "중지"를 누르면 `cancelled`를 세운다. */
export interface TicketCancelToken {
  cancelled: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 요청(웨이브) 하나를 가리킬 식별자를 만든다. `nlAgentClient.createNlRequestId`와
 * 같은 이유·같은 fallback이다 — `crypto.randomUUID`가 없는 환경에서도 요청이
 * 통째로 실패할 이유는 없다.
 */
export function createTicketRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 요청 파일을 쓰고 응답이 올 때까지 폴링한다.
 *
 * 취소는 토큰으로 받는다 — 루프가 매 회차 앞에서 토큰을 보므로, 취소가 걸리면
 * 다음 GET을 아예 보내지 않는다(`nlAgentClient.requestNlEdit`과 같은 패턴).
 */
export async function requestTicketBatch(
  input: BuildTicketRequestInput,
  cancel: TicketCancelToken,
): Promise<TicketBatchOutcome> {
  const request = buildTicketRequest(input);

  const written = await writeWorkspaceFile(
    TICKET_REQUEST_PATH,
    JSON.stringify(request, null, 2),
    "application/json",
  );
  if (!written.ok) {
    return written.error === "작업공간에 연결돼 있지 않습니다."
      ? {
          kind: "unavailable",
          message:
            "작업공간에 연결돼 있지 않습니다. `npx visual-spec`으로 GUI를 띄우면 티켓 실행을 쓸 수 있습니다.",
        }
      : { kind: "writeFailed", message: `요청을 저장하지 못했습니다 — ${written.error}` };
  }

  const deadline = Date.now() + TICKET_TIMEOUT_MS;
  for (;;) {
    if (cancel.cancelled) return { kind: "cancelled" };

    // 파일을 바로 GET하지 않고 목록으로 있는지 먼저 본다 — 아직 안 온 응답을 404로
    // 반복 조회하며 콘솔을 채우지 않는다(`nlAgentClient.requestNlEdit`과 같은 이유).
    const files = await listWorkspaceFiles(RUNTIME_DIR);
    const result =
      files !== null && files.includes(TICKET_RESPONSE_FILE)
        ? parseTicketResponse(await readWorkspaceTextFile(TICKET_RESPONSE_PATH), request.id)
        : ({ kind: "stale" } as const);
    if (result.kind !== "stale") return { kind: "response", result };

    if (Date.now() >= deadline) {
      return {
        kind: "timeout",
        message: `${Math.round(TICKET_TIMEOUT_MS / 1000)}초 동안 응답이 오지 않았습니다. 에이전트가 ${TICKET_REQUEST_PATH}를 읽고 ${TICKET_RESPONSE_PATH}에 결과를 쓰게 하세요.`,
      };
    }
    await sleep(TICKET_POLL_INTERVAL_MS);
  }
}

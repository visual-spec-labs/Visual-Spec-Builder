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
  readWorkspaceTextFileStrict,
  writeWorkspaceFile,
} from "@/features/editor/ui/workspaceClient";
import { holdRequestLock, type HeldRequestLock } from "@/features/editor/ui/agentRequestLock";
import {
  AGENT_WAIT_WINDOW_MS,
  createAgentRequestWait,
  type AgentRequestWait,
} from "@/features/editor/ui/agentRequestWait";
import { hasUnsupportedScreenRelations, UNSUPPORTED_SCREEN_RELATIONS_MESSAGE } from "@/features/editor/ticket/screenRelationsGuard";
import { RUNTIME_DIR, STAGING_DIR } from "@/features/workspace/protocol";

import {
  buildTicketRequest,
  parseTicketResponse,
  TICKET_PROTOCOL_VERSION,
  TICKET_REQUEST_PATH,
  TICKET_RESPONSE_PATH,
  TICKET_RESPONSE_FILE,
  type BuildTicketRequestInput,
  type TicketResponseResult,
} from "./ticketProtocol";

import { prepareStoredProjectRequest } from "@/features/editor/ui/projectInputStorage";
import { parseProjectTicketResponse, serializeProjectTicketRequest, type ProjectTicketResponse } from "./projectTicketProtocol";

/** 응답을 확인하는 간격. `nlAgentClient.NL_POLL_INTERVAL_MS`와 같은 값이다. */
export const TICKET_POLL_INTERVAL_MS = 1000;

/**
 * 처음 기다리는 시간. 자연어 통로와 같은 창을 쓴다 — 연장도 같은 규칙이다
 * (`ui/agentRequestWait.ts`, #284). 고정 기한이 아니라 사용자가 "대기 연장"으로 미룰 수 있다.
 */
export const TICKET_TIMEOUT_MS = AGENT_WAIT_WINDOW_MS;

export type TicketBatchOutcome<Result = TicketResponseResult> =
  | { kind: "unsupported"; message: string }
  | { kind: "unavailable"; message: string }
  /** 같은 작업공간의 다른 탭 요청이 아직 응답을 기다린다(#273). 요청 파일을 쓰지 않았다. */
  | { kind: "busy"; message: string }
  /**
   * 요청 파일은 썼지만 폴링 중 잠금을 잃었다(#283 리뷰 대응) — `busy`와 구분하는
   * 이유는 재시도 안내가 맞는 쪽이 이쪽뿐이라서다. `busy`는 요청 자체를 안 썼으니
   * "다른 탭이 끝나길 기다려라"가 맞고, 이쪽은 이미 쓴 요청이 더 이상 누구도
   * 기다리지 않는 상태라 timeout과 똑같이 "다시 전달해야" 뜻이 있다.
   */
  | { kind: "lockLost"; message: string }
  | { kind: "writeFailed"; message: string }
  | { kind: "timeout"; message: string }
  /**
   * 기한까지 작업공간 서버에 닿지 못했다(#284). `timeout`과 가르는 이유는 다음 행동이 달라서다 —
   * 이쪽은 에이전트가 아니라 개발 서버(`npx visual-spec`)부터 확인해야 한다.
   */
  | { kind: "connectionLost"; message: string }
  | { kind: "cancelled" }
  | { kind: "response"; result: Result; lock?: HeldRequestLock };

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
 * 다음 GET을 아예 보내지 않는다(`nlAgentClient.requestNlEdit`과 같은 패턴). 취소는 GUI가
 * 기다림을 멈추는 것이지 에이전트를 멈추는 것이 아니다 — 그 요청이 늦게 쓰는 파일은 요청
 * 전용 임시 출력에 남고, 확정은 호출부가 현재 요청에 대해서만 한다(docs/26).
 *
 * `wait`는 호출부가 "대기 연장" 버튼과 진행 표시를 위해 넘긴다. 결과가 정해지면 여기서
 * `settle`한다 — 끝난 요청은 연장되지 않는다.
 */
export async function requestTicketBatch(
  input: BuildTicketRequestInput,
  cancel: TicketCancelToken,
  wait: AgentRequestWait = createAgentRequestWait(),
  /** 출력 확정 호출자는 true로 넘기고 response.lock을 finally에서 해제한다. */
  retainLock = false,
): Promise<TicketBatchOutcome> {
  try {
    return await sendTicketBatch(input, cancel, wait, retainLock);
  } finally {
    wait.settle();
  }
}

type StoredProjectRequest = Awaited<ReturnType<typeof prepareStoredProjectRequest>>;
export type ProjectTicketBatchOutcome = Exclude<TicketBatchOutcome<ProjectTicketResponse>, { kind: "response" }>
  | { kind: "response"; result: ProjectTicketResponse; lock: HeldRequestLock; prepared: StoredProjectRequest };

/** Project producer supplies a manifest-owned root and provenance-verified plan statuses.
 * Storage and dispatch share the request lease; response callers retain it through acceptance.
 */
export async function requestProjectTicketBatch(
  input: Parameters<typeof prepareStoredProjectRequest>[0],
  cancel: TicketCancelToken,
  wait: AgentRequestWait = createAgentRequestWait(),
): Promise<ProjectTicketBatchOutcome> {
  const captured = { ...input, project: structuredClone(input.project), plan: structuredClone(input.plan), ticketIds: [...input.ticketIds] };
  const current = { get cancelled() { return cancel.cancelled || captured.signal?.aborted === true || !captured.isCurrent(); } };
  try {
    let prepared: StoredProjectRequest | undefined;
    const outcome = await sendTicketTransport(captured.requestId, async () => {
      prepared = await prepareStoredProjectRequest({ ...captured, isCurrent: () => !current.cancelled });
      const { request } = prepared;
      return { id: request.id, protocol: request.protocol, body: serializeProjectTicketRequest(request),
        parse: (text: string | null) => text === null ? { kind: "stale" as const } : parseProjectTicketResponse(text, request),
        stagingFiles: request.tickets.map((ticket) => ticket.outputPath) };
    }, current, wait, true, true);
    if (outcome.kind !== "response") return outcome;
    // requireLease and retainLock guarantee both; never expose an unlocked acceptance candidate.
    if (!outcome.lock || !prepared) { outcome.lock?.release(); throw Error("프로젝트 응답의 입력/잠금 근거가 없습니다."); }
    return { ...outcome, lock: outcome.lock, prepared };
  } catch (error) {
    if (current.cancelled) return { kind: "cancelled" };
    return { kind: "writeFailed", message: error instanceof Error ? error.message : "프로젝트 요청을 준비하지 못했습니다." };
  } finally { wait.settle(); }
}

interface TicketWire<Result> {
  id: string;
  protocol: number;
  body: string;
  parse: (text: string | null) => Result;
  /**
   * 이 웨이브의 모든 티켓이 쓸 임시 출력의 정확한 경로(`outputPath`, #432 리뷰 대응).
   * 서버의 재귀 목록은 전체 `staging/` 아래 2,000개까지만 보므로, 다른(오래된) 요청의
   * 파일이 그 상한을 채우면 이 요청의 새 파일이 아예 목록에 안 보일 수 있다 — 경로를
   * 직접 알고 있으니 목록 대신 하나씩 확인한다.
   */
  stagingFiles: readonly string[];
}

async function sendTicketBatch(
  input: BuildTicketRequestInput,
  cancel: TicketCancelToken,
  wait: AgentRequestWait,
  retainLock: boolean,
): Promise<TicketBatchOutcome> {
  if (hasUnsupportedScreenRelations(input.page)) {
    return { kind: "unsupported", message: UNSUPPORTED_SCREEN_RELATIONS_MESSAGE };
  }
  const request = buildTicketRequest(input);

  return sendTicketTransport(request.id, async () => ({ id: request.id, protocol: TICKET_PROTOCOL_VERSION,
    body: JSON.stringify(request, null, 2), parse: (text: string | null) => parseTicketResponse(text, request.id),
    stagingFiles: request.tickets.map((ticket) => ticket.outputPath) }), cancel, wait, retainLock);
}

async function sendTicketTransport<Result extends { kind: string }>(
  id: string, prepare: () => Promise<TicketWire<Result>>, cancel: TicketCancelToken,
  wait: AgentRequestWait, retainLock: boolean, requireLease = false,
): Promise<TicketBatchOutcome<Result>> {
  const lock = await holdRequestLock("ticket", id, () => cancel.cancelled);
  if (lock === "busy") {
    if (cancel.cancelled) return { kind: "cancelled" };
    return {
      kind: "busy",
      message: "다른 탭(창)에서 보낸 티켓 실행 요청이 아직 응답을 기다리고 있습니다. 그 요청이 끝나거나 취소된 뒤 다시 시도하세요.",
    };
  }
  let transferred = false;
  try {
    // 잠금을 기다리는 사이 취소됐으면 요청 파일을 쓰지 않는다 — 쓰면 외부 에이전트가 정리 전에
    // 읽고 실행할 수 있다(PR #296 리뷰). 잠금은 아래 finally가 푼다.
    if (cancel.cancelled) return { kind: "cancelled" };
    if (requireLease && lock === "unavailable") return { kind: "unavailable", message: "프로젝트 요청에는 작업공간 요청 잠금이 필요합니다." };
    const request = await prepare();
    if (cancel.cancelled) return { kind: "cancelled" };
    if (requireLease && lock !== "unavailable" && !await lock.renew(true)) return { kind: "lockLost", message: "프로젝트 요청을 저장하기 전에 잠금을 확인하지 못했습니다." };
    if (cancel.cancelled) return { kind: "cancelled" };
    const outcome = await waitForTicketResponse(request, cancel, wait, lock === "unavailable" ? null : lock);
    if (retainLock && outcome.kind === "response" && lock !== "unavailable") {
      transferred = true;
      return { ...outcome, lock };
    }
    return outcome;
  } finally {
    if (!transferred && lock !== "unavailable") lock.release();
  }
}

async function waitForTicketResponse<Result extends { kind: string }>(
  request: TicketWire<Result>,
  cancel: TicketCancelToken,
  wait: AgentRequestWait,
  lock: HeldRequestLock | null,
): Promise<TicketBatchOutcome<Result>> {
  const written = await writeWorkspaceFile(
    TICKET_REQUEST_PATH,
    request.body,
    "application/json",
    undefined,
    request.id,
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

  wait.start();
  // timeout 문구에 쓴다 — 기다림이 끝난 뒤에는 `wait`의 진행 상태가 화면에서 사라지므로
  // (#432) 몇 개를 버렸는지는 이 메시지에만 남는다.
  let lastKnownStaged: number | undefined;
  // 경로마다 지난 회차에 읽은 내용(없으면 null). 개수가 그대로여도 어느 파일의 내용이
  // 달라졌으면 에이전트가 그 파일을 계속 고쳐 쓰는 중이라는 증거다(#432 리뷰 대응) —
  // "N/M개" 표시는 개수 그대로 두고, 이 변화만 따로 자동연장 증거로 알린다.
  const lastContent = new Map<string, string | null>(request.stagingFiles.map((path) => [path, null]));
  for (;;) {
    if (cancel.cancelled) return { kind: "cancelled" };
    // 연결이 끊긴 동안 잠금 연장은 서버에 닿지 않아 true로 지나간다. 복구된 첫 회차에 연장이
    // 서버에 닿으면서 소유권을 다시 확인한다 — 끊긴 사이 기한이 지나 다른 탭이 가져갔으면 여기서 끝난다.
    if (lock !== null && !await lock.renew()) {
      return {
        kind: "lockLost",
        message: "응답을 기다리는 사이 요청 잠금이 만료돼 다른 탭의 요청으로 바뀌었습니다. 다시 요청하세요.",
      };
    }

    // 파일을 바로 GET하지 않고 목록으로 있는지 먼저 본다 — 아직 안 온 응답을 404로
    // 반복 조회하며 콘솔을 채우지 않는다(`nlAgentClient.requestNlEdit`과 같은 이유).
    // 목록이 null이면 작업공간 서버에 닿지 않은 것이다 — "아직 응답 없음"과 구분해 알린다.
    const files = await listWorkspaceFiles(RUNTIME_DIR);
    if (files === null) {
      wait.report("connectionLost");
    } else {
      // 이 요청의 임시 출력이 보이는지 — GUI가 가진 유일한 에이전트 활동 근거다. 표시용일 뿐
      // 수용 판단에는 쓰지 않는다(확정은 경로별로 직접 읽는다). 경로를 알고 있는 만큼만
      // 하나씩 확인한다 — 서버의 재귀 목록(2,000개 상한)은 전체 staging/ 아래를 보므로
      // 오래된 다른 요청의 파일이 그 상한을 채우면 이 요청의 새 파일이 아예 안 보일 수
      // 있다(#432 리뷰 대응).
      let changed = false;
      const probes = await Promise.all(request.stagingFiles.map((path) => readWorkspaceTextFileStrict(path)));
      request.stagingFiles.forEach((path, index) => {
        const probe = probes[index];
        // 이 파일 하나만 읽기 실패할 수 있다 — 그 회차는 직전까지 알던 상태를 그대로 둔다
        // (전체 목록이 통째로 실패하는 연결 끊김과는 다르다. 이 분기는 RUNTIME_DIR가 이미
        // 됐을 때만 들어온다).
        if (!probe.ok) return;
        if (probe.text !== lastContent.get(path)) {
          changed = true;
          lastContent.set(path, probe.text);
        }
      });
      lastKnownStaged = [...lastContent.values()].filter((text) => text !== null).length;
      wait.report("waiting", lastKnownStaged, changed);
    }
    const result =
      files !== null && files.includes(TICKET_RESPONSE_FILE)
        ? request.parse(await readWorkspaceTextFile(TICKET_RESPONSE_PATH))
        : null;
    if (cancel.cancelled) return { kind: "cancelled" };
    if (!wait.expired() && result !== null && result.kind !== "stale") {
      // A slow response GET may outlive the lease. Verify ownership again before accepting it.
      if (lock !== null && !await lock.renew(true)) {
        return { kind: "lockLost", message: "응답 수용 전에 요청 잠금을 확인하지 못했습니다. 다시 요청하세요." };
      }
      if (cancel.cancelled) return { kind: "cancelled" };
      if (!wait.expired()) return { kind: "response", result };
    }

    if (wait.expired()) {
      // 원시 경로는 더 이상 이 문구에 넣지 않는다(#283) — 패널이 "자세히"로
      // 같은 경로를 보여주고, 이 문구는 사람이 다음에 할 일만 말한다.
      return files === null
        ? {
            kind: "connectionLost",
            message: "작업공간 연결이 끊긴 채 대기 시간이 끝났습니다. 개발 서버(`npx visual-spec`)가 실행 중인지 확인한 뒤 다시 요청하세요.",
          }
        : {
            kind: "timeout",
            // 구버전 스킬(티켓 요청 규약 v2)은 v3 요청을 받으면 응답 없이 멈추고 에이전트 대화에만 버전 불일치를
            // 알린다(#281 리뷰) — GUI에서는 이 만료로만 보이므로 그 경우의 할 일을 함께 적는다.
            // 임시 출력이 있었다면(#432) 몇 개가 버려졌는지와 그게 generated/에 반영되지 않았다는
            // 점을 먼저 말한다 — 활동 증거가 있었는데도 끝났다는 뜻을 소스 없이 읽는 사람도 알아야 한다.
            // "대기 시간 안에 응답이 오지 않았다"는 사실은 두 분기 중 하나에서만 말한다 —
            // staged 분기가 이미 같은 사실을 담고 있어 둘 다 넣으면 같은 말을 두 번 한다.
            message:
              (lastKnownStaged !== undefined && lastKnownStaged > 0
                ? `에이전트가 이 요청의 임시 출력 ${lastKnownStaged}개를 \`${STAGING_DIR}/${request.id}/\`에 썼지만, 대기 시간 안에 응답을 받지 못해 확정하지 않았습니다 — 그 파일들은 generated/에 반영되지 않습니다. `
                : "대기 시간 안에 응답이 오지 않았습니다. ") +
              "에이전트가 요청을 처리했는지 확인한 뒤, 안 됐다면 다시 요청해 새 지시를 전달하세요. 다시 전달하면 새 요청 ID와 새 임시 출력 폴더로 진행되며, 버려진 임시 출력은 다시 쓰지 않습니다. " +
              `에이전트가 티켓 요청 규약 버전이 다르다고 알렸다면 \`visual-spec skills\`로 스킬을 갱신한 뒤 다시 전달하세요(이 GUI는 규약 v${request.protocol}).`,
          };
    }
    await sleep(TICKET_POLL_INTERVAL_MS);
  }
}

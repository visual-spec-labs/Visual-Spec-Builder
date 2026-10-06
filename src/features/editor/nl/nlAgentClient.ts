/**
 * 자연어 요청을 `.visual-spec/runtime/`에 내려놓고 에이전트의 응답을 기다리는
 * 브라우저 쪽 절반 (이슈 #155).
 *
 * 반대편 절반은 사람이 켜 둔 에이전트(Claude Code·Codex)다 — 앱은 LLM을 부르지
 * 않는다(docs/08 2.3의 (b)). 규약과 그 선택 근거는 `nlProtocol.ts` 상단에 적었다.
 *
 * 파일 입출력은 이미 있는 얇은 클라이언트(`ui/workspaceClient.ts`)를 그대로 쓴다 —
 * 작업공간이 없을 때 조용히 `null`로 떨어지는 동작까지 같이 물려받는다.
 *
 * **폴링인 이유.** 미들웨어에는 파일 변경을 알려주는 통로가 없다(라우트 셋은 전부
 * 요청-응답이다). SSE나 WebSocket을 새로 여는 것은 라우트를 늘리는 일이라
 * #133이 좁혀 둔 공격면을 다시 넓힌다 — 답을 언제 받을지 모르는 대가를
 * 1초짜리 GET 하나로 치르는 편이 싸다.
 */

import {
  listWorkspaceFiles,
  readWorkspaceTextFile,
  writeWorkspaceFile,
} from "@/features/editor/ui/workspaceClient";
import { holdRequestLock, type HeldRequestLock } from "@/features/editor/ui/agentRequestLock";
import { RUNTIME_DIR } from "@/features/workspace/protocol";

import {
  buildNlRequest,
  parseNlResponse,
  NL_REQUEST_PATH,
  NL_RESPONSE_PATH,
  NL_RESPONSE_FILE,
  type BuildNlRequestInput,
  type NlResponseResult,
} from "./nlProtocol";

/** 응답을 확인하는 간격. 사람이 에이전트에 요청을 옮기는 시간에 비하면 충분히 촘촘하다. */
export const NL_POLL_INTERVAL_MS = 1000;

/**
 * 기다리기를 포기하는 시각. 3분이다.
 *
 * 에이전트가 답을 쓰기까지 사람의 조작(창 전환·요청 전달)이 끼는 경로라 몇 초로는
 * 모자라고, 무한정 기다리면 "요청 중"에 갇혀 다음 요청을 못 한다. 포기해도 요청
 * 파일은 남으므로 에이전트가 늦게 답을 써도 다음 요청 때 `requestId`가 달라
 * 조용히 무시된다(`parseNlResponse`의 `stale`).
 */
export const NL_TIMEOUT_MS = 180_000;

export type NlRequestOutcome =
  | { kind: "unavailable"; message: string }
  /** 같은 작업공간의 다른 탭 요청이 아직 응답을 기다린다(#273). 요청 파일을 쓰지 않았다. */
  | { kind: "busy"; message: string }
  | { kind: "writeFailed"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "cancelled" }
  | { kind: "response"; result: NlResponseResult };

/** 취소 신호. 호출부(입력창)가 "요청 취소"를 누르면 `cancelled`를 세운다. */
export interface NlCancelToken {
  cancelled: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 요청 하나를 가리킬 식별자를 만든다.
 *
 * `crypto.randomUUID`는 보안 컨텍스트에서만 있다 — GUI는 localhost라 보통 있지만,
 * 없을 때 요청이 통째로 실패할 이유는 없어서 시각+난수로 떨어진다. 이 값에 요구되는
 * 성질은 "직전 요청과 다르다"뿐이다(응답 짝 맞추기, `nlProtocol.ts`).
 */
export function createNlRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `nl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 요청 파일을 쓰고 응답이 올 때까지 폴링한다.
 *
 * 취소는 토큰으로 받는다 — `AbortController`를 쓰지 않는 이유는 여기서 끊어야 하는
 * 것이 fetch 하나가 아니라 **폴링 루프 전체**여서다. 루프가 매 회차 앞에서 토큰을
 * 보므로, 취소가 걸리면 다음 GET을 아예 보내지 않는다.
 */
export async function requestNlEdit(
  input: BuildNlRequestInput,
  cancel: NlCancelToken,
): Promise<NlRequestOutcome> {
  const request = buildNlRequest(input);

  // 같은 작업공간의 다른 탭 요청을 덮어쓰지 않도록 요청 파일 잠금부터 잡는다(#273).
  const lock = await holdRequestLock("nl", request.id);
  if (lock === "busy") {
    return {
      kind: "busy",
      message: "다른 탭(창)에서 보낸 자연어 요청이 아직 응답을 기다리고 있습니다. 그 요청이 끝나거나 취소된 뒤 다시 시도하세요.",
    };
  }
  try {
    return await waitForNlResponse(request, cancel, lock === "unavailable" ? null : lock);
  } finally {
    if (lock !== "unavailable") lock.release();
  }
}

async function waitForNlResponse(
  request: ReturnType<typeof buildNlRequest>,
  cancel: NlCancelToken,
  lock: HeldRequestLock | null,
): Promise<NlRequestOutcome> {
  const written = await writeWorkspaceFile(
    NL_REQUEST_PATH,
    JSON.stringify(request, null, 2),
    "application/json",
    undefined,
    request.id,
  );
  if (!written.ok) {
    // 작업공간이 없을 때가 가장 흔하다 — 그때는 고치는 방법까지 함께 말해 준다.
    return written.error === "작업공간에 연결돼 있지 않습니다."
      ? {
          kind: "unavailable",
          message:
            "작업공간에 연결돼 있지 않습니다. `npx visual-spec`으로 GUI를 띄우면 자연어 편집을 쓸 수 있습니다.",
        }
      : { kind: "writeFailed", message: `요청을 저장하지 못했습니다 — ${written.error}` };
  }

  const deadline = Date.now() + NL_TIMEOUT_MS;
  for (;;) {
    if (cancel.cancelled) return { kind: "cancelled" };
    if (lock !== null && !await lock.renew()) {
      return {
        kind: "busy",
        message: "응답을 기다리는 사이 요청 잠금이 만료돼 다른 탭의 요청으로 바뀌었습니다. 다시 요청하세요.",
      };
    }

    // 파일을 바로 GET하지 않고 **목록으로 있는지 먼저 본다.** 응답이 아직 없을 때
    // GET은 404이고, 초당 한 번씩 3분이면 개발자 도구 콘솔이 404로 가득 찬다 —
    // 정상 동작(아직 안 왔다)이 오류처럼 보이면 진짜 오류를 그 속에서 못 찾는다.
    // 목록 라우트는 폴더가 비어도 200이라 그 일이 생기지 않는다.
    const files = await listWorkspaceFiles(RUNTIME_DIR);
    const result =
      files !== null && files.includes(NL_RESPONSE_FILE)
        ? parseNlResponse(await readWorkspaceTextFile(NL_RESPONSE_PATH), request.id)
        : ({ kind: "stale" } as const);
    if (result.kind !== "stale") return { kind: "response", result };

    if (Date.now() >= deadline) {
      return {
        kind: "timeout",
        message: `${Math.round(NL_TIMEOUT_MS / 1000)}초 동안 응답이 오지 않았습니다. 에이전트가 ${NL_REQUEST_PATH}를 읽고 ${NL_RESPONSE_PATH}에 답을 쓰게 하세요.`,
      };
    }
    await sleep(NL_POLL_INTERVAL_MS);
  }
}

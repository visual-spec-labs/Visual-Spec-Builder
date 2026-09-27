/**
 * GUI ↔ 외부 에이전트가 주고받는 자연어 편집 요청/응답의 **형식 계약** (이슈 #155).
 *
 * docs/08-natural-language.md 2.3이 실행 주체를 **(b) 에이전트 경유**로 정했다 —
 * 앱은 LLM을 부르지 않는다. 그래서 "요청을 건네고 Command 배열을 돌려받을 통로"가
 * 필요하고, 이 파일이 그 통로의 **파일 이름과 JSON 모양**을 한 곳에 모은다.
 *
 * ## 왜 파일 교환인가
 *
 * 후보는 셋이었다.
 *
 * 1. **파일 교환** — GUI가 `.visual-spec/runtime/`에 요청을 쓰고, 에이전트가 읽어
 *    Command 배열을 같은 폴더에 쓰고, GUI가 그걸 읽는다.
 * 2. **붙여넣기** — 사용자가 에이전트에게 직접 묻고 받은 Command JSON을 입력창에
 *    붙여넣는다.
 * 3. 앱이 직접 LLM 호출 — 2.3이 (a)로 거부했다.
 *
 * 1을 골랐다. 근거는 셋이다.
 *
 * - **이미 깔린 통로를 그대로 쓴다.** #133(PR #145)이 `/__vs/file/<폴더>/<경로>`
 *   GET·PUT을 열어 뒀고 `bin/visual-spec.mjs`의 `initWorkspace`가 `runtime/` 폴더를
 *   이미 만든다. 새 라우트도, 새 의존성도 필요 없다 — 화이트리스트에 폴더 한 줄
 *   (`runtime: [".json"]`)을 더하는 것이 전부다.
 * - **2는 "자연어로 말한다"가 안 된다.** 사용자가 Command JSON을 손으로 나르면
 *   입력창은 자연어 입력창이 아니라 JSON 붙여넣기 칸이다. 03-user-flow.md가 요구한
 *   적용 범위 표시도 의미를 잃는다(범위를 정하는 건 사용자가 에이전트에게 말할 때다).
 * - **요청에 화면 스펙을 통째로 실어 보낼 수 있다.** 붙여넣기 경로에서는 사용자가
 *   노드 id와 현재 값을 직접 옮겨 적어야 한다. 파일이면 GUI가 `ScreenSpec`을 그대로
 *   넣어 주므로 에이전트가 "지금 화면이 무엇인지"를 추측하지 않는다.
 *
 * ## 핸드셰이크
 *
 * ```
 * GUI                                  에이전트
 *  │ PUT runtime/nl-request.json  ──▶   (읽는다)
 *  │                                     Command 배열을 만든다
 *  │ GET runtime/nl-response.json ◀──   PUT runtime/nl-response.json
 *  │   requestId가 같아질 때까지 폴링
 *  ▼
 * G1 validateTransaction → G2·G3 applyGuardedTransaction → history 한 단계
 * ```
 *
 * 응답은 **덮어쓰기 한 파일**이다. 요청마다 파일 이름을 바꾸지 않는 이유는 지운
 * 요청의 찌꺼기가 폴더에 쌓이기 때문이고, 대신 `requestId`로 짝을 맞춘다 —
 * 낡은 응답을 이번 요청의 답으로 오인하지 않는 것이 이 필드의 존재 이유다.
 *
 * ## 이 파일이 신뢰하지 않는 것
 *
 * 응답 JSON은 **바깥에서 온 값**이다. 그래서 `parseNlResponse`는 어떤 모양이 와도
 * 예외를 던지지 않고 판정을 돌려주고, Command 배열은 그 자리에서 G1
 * (`command/validate.ts`의 `validateTransaction`)을 통과시킨다. G2·G3는 그 뒤
 * `editorStore.applyGuardedTransaction`이 맡는다(docs/08 4.2).
 */

import type { CommandValidationIssue } from "@/features/editor/command/validate";
import { validateTransaction } from "@/features/editor/command/validate";
import type { Command } from "@/features/editor/command/types";
import type { NodeId, PageId, ScreenSpec } from "@/features/editor/schema";
import { RUNTIME_DIR } from "@/features/workspace/protocol";

/**
 * 요청/응답 JSON에 함께 실리는 형식 버전.
 *
 * 에이전트 쪽 구현이 GUI보다 오래된 규약을 들고 있을 수 있다 — 둘은 각자
 * 갱신되기 때문이다. 버전이 다르면 조용히 이상한 Command를 만드는 대신
 * `parseNlResponse`가 걸러 낸다.
 */
export const NL_PROTOCOL_VERSION = 1;

/** GUI가 쓰는 요청 파일(작업공간 루트 기준 상대 경로). */
export const NL_REQUEST_PATH = `${RUNTIME_DIR}/nl-request.json`;

/** 응답 파일 이름. 목록 라우트가 돌려주는 값과 맞춰 보는 데 쓴다(`nlAgentClient.ts`). */
export const NL_RESPONSE_FILE = "nl-response.json";

/** 에이전트가 쓰는 응답 파일. GUI가 이 파일을 폴링한다. */
export const NL_RESPONSE_PATH = `${RUNTIME_DIR}/${NL_RESPONSE_FILE}`;

/** 적용 범위 — 03-user-flow.md의 "적용 대상". 1차는 둘뿐이다("전체 프로젝트" 제외). */
export type NlScopeKind = "node" | "screen";

export interface NlScope {
  kind: NlScopeKind;
  /** `kind`가 `"node"`일 때 대상 노드. 화면 범위면 null. */
  nodeId: NodeId | null;
  /** 입력창 위에 그대로 보여 줄 한국어 라벨. */
  label: string;
}

export interface NlRequest {
  protocol: number;
  /** 이 요청의 식별자. 응답의 `requestId`와 같아야 짝으로 인정한다. */
  id: string;
  /** 사용자가 입력창에 적은 자연어 그대로. */
  instruction: string;
  scope: NlScope;
  /** 대상 페이지. 1차는 **활성 페이지 한 장**뿐이다(docs/08 7.2). */
  pageId: PageId;
  /** 대상 페이지의 현재 스펙 전체. 에이전트가 노드 id와 현재 값을 여기서 읽는다. */
  page: ScreenSpec;
  /** 에이전트가 답을 써야 하는 자리. 규약을 문서 밖에서도 알 수 있게 실어 보낸다. */
  responsePath: string;
}

export interface BuildNlRequestInput {
  id: string;
  instruction: string;
  scope: NlScope;
  pageId: PageId;
  page: ScreenSpec;
}

/** 요청 파일에 쓸 객체를 만든다. 순수 함수 — 파일을 쓰지 않는다. */
export function buildNlRequest(input: BuildNlRequestInput): NlRequest {
  return {
    protocol: NL_PROTOCOL_VERSION,
    id: input.id,
    instruction: input.instruction,
    scope: input.scope,
    pageId: input.pageId,
    page: input.page,
    responsePath: NL_RESPONSE_PATH,
  };
}

/**
 * 응답 판정.
 *
 * - `stale` — 아직 이번 요청의 답이 아니다(파일이 없거나 `requestId`가 다르다).
 *   호출부는 **계속 기다린다.** 다른 값들은 전부 기다림을 끝낸다.
 * - `malformed` — JSON이 아니거나 모양이 규약과 다르다.
 * - `agentError` — 에이전트가 "못 하겠다"고 명시적으로 답했다.
 * - `invalid` — Command 배열이 G1(Command 스키마)을 통과하지 못했다.
 * - `commands` — 통과. G2·G3로 넘긴다.
 */
export type NlResponseResult =
  | { kind: "stale" }
  | { kind: "malformed"; message: string }
  | { kind: "agentError"; message: string }
  | { kind: "invalid"; issues: CommandValidationIssue[] }
  | { kind: "commands"; commands: Command[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 응답 파일 본문을 판정한다. **절대 예외를 던지지 않는다** — 바깥에서 온 값이라
 * 어떤 모양이든 올 수 있고, 그걸 판정으로 바꾸는 것이 이 함수의 일이다.
 *
 * `text`가 null이면(파일이 아직 없다) `stale`이다. 폴링 호출부가 "없음"과 "낡음"을
 * 나눠 다룰 이유가 없어서 한 값으로 합쳤다 — 둘 다 "더 기다린다"로 끝난다.
 */
export function parseNlResponse(
  text: string | null,
  requestId: string,
): NlResponseResult {
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

  // requestId를 **가장 먼저** 본다. 낡은 응답에 담긴 오류 메시지를 이번 요청의
  // 실패로 보여주면 사용자가 방금 한 요청이 실패했다고 오해한다.
  if (body.requestId !== requestId) return { kind: "stale" };

  if (body.protocol !== NL_PROTOCOL_VERSION) {
    return {
      kind: "malformed",
      message: `응답 형식 버전이 다릅니다(기대: ${NL_PROTOCOL_VERSION}, 받음: ${JSON.stringify(body.protocol)}).`,
    };
  }

  if (typeof body.error === "string" && body.error !== "") {
    return { kind: "agentError", message: body.error };
  }

  // G1 — Command 배열의 형태 검사(#153). Transaction 모양으로 감싸서 넘긴다.
  const result = validateTransaction({ commands: body.commands });
  if (!result.valid) {
    return { kind: "invalid", issues: result.issues };
  }

  return { kind: "commands", commands: body.commands as Command[] };
}

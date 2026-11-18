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
import { COMMAND_VERSION, type Command } from "@/features/editor/command/types";
import type { WidgetProjectCommand } from "@/features/editor/command/widgetProjectCommand";
import type { CreatePageCommand } from "@/features/editor/command/createPageCommand";
import type { NodeId, PageId, ScreenSpec, ProjectSpec, ScreenKind } from "@/features/editor/schema";
import { RUNTIME_DIR } from "@/features/workspace/protocol";

/**
 * 요청/응답 JSON에 함께 실리는 형식 버전.
 *
 * 에이전트 쪽 구현이 GUI보다 오래된 규약을 들고 있을 수 있다 — 둘은 각자
 * 갱신되기 때문이다. 버전이 다르면 조용히 이상한 Command를 만드는 대신
 * `parseNlResponse`가 걸러 낸다.
 */
export const NL_PROTOCOL_VERSION = 2;

/** GUI가 쓰는 요청 파일(작업공간 루트 기준 상대 경로). */
export const NL_REQUEST_PATH = `${RUNTIME_DIR}/nl-request.json`;

/** 응답 파일 이름. 목록 라우트가 돌려주는 값과 맞춰 보는 데 쓴다(`nlAgentClient.ts`). */
export const NL_RESPONSE_FILE = "nl-response.json";

/** 에이전트가 쓰는 응답 파일. GUI가 이 파일을 폴링한다. */
export const NL_RESPONSE_PATH = `${RUNTIME_DIR}/${NL_RESPONSE_FILE}`;

/**
 * 적용 범위 — 03-user-flow.md의 "적용 대상".
 *
 * `"newPage"`는 현재 화면을 고치는 둘과 **다른 단위**다(#497) — 활성 `ScreenSpec` 한 장이 아니라
 * 프로젝트에 페이지를 더한다. 그래서 응답도 `commands`가 아니라 `projectCommand`의 `createPage`로
 * 온다. "전체 프로젝트"는 여전히 없다(docs/08 7.2) — 있는 화면들을 한꺼번에 바꾸는 범위는
 * 위험하다는 03의 판단이 그대로다. 새 페이지는 **아무것도 덮어쓰지 않아** 그 위험이 없다.
 */
export type NlScopeKind = "node" | "screen" | "newPage";

export interface NlScope {
  kind: NlScopeKind;
  /** `kind`가 `"node"`일 때 대상 노드. 화면·새 페이지 범위면 null. */
  nodeId: NodeId | null;
  /** 입력창 위에 그대로 보여 줄 한국어 라벨. */
  label: string;
}

export interface NlDestination {
  readonly pageId: PageId;
  readonly name: string;
  readonly kind: ScreenKind;
}

/** Destination metadata never exposes unrelated page/modal node trees. */
export function buildDestinationCatalog(project: ProjectSpec): NlDestination[] {
  return project.pageOrder.flatMap((pageId) => {
    const page = project.pages[pageId];
    return page ? [{ pageId, name: page.name, kind: page.kind ?? "page" }] : [];
  });
}

export interface NlWidgetSource { readonly pageId: PageId; readonly screen: ScreenSpec }

/** A bounded read-only snapshot of widget sources reached by the active screen. */
export function buildWidgetSourceCatalog(project: ProjectSpec, page: ScreenSpec): NlWidgetSource[] {
  const visited = new Set<string>();
  const pending = Object.values(page.nodes).flatMap(node => node.type === 'instance' ? [node.ref] : []);
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const screen = Object.hasOwn(project.pages, id) ? project.pages[id] : undefined;
    if (screen?.kind !== 'widget') continue;
    pending.push(...Object.values(screen.nodes).flatMap(node => node.type === 'instance' ? [node.ref] : []));
  }
  return project.pageOrder.filter(id => visited.has(id) && project.pages[id].kind === 'widget')
    .map(pageId => ({ pageId, screen: structuredClone(project.pages[pageId]) }));
}

export interface NlRequest {
  commandVersion: typeof COMMAND_VERSION;
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
  /** Optional protocol-2 request context; does not expand mutation scope. */
  destinations?: readonly NlDestination[];
  /** Only widget sources transitively referenced by the active page; read-only context. */
  widgets?: readonly NlWidgetSource[];
  /**
   * 새 페이지 범위에서 **GUI가 발급한** 충돌 없는 새 PageId (#497).
   *
   * 에이전트가 id를 짓지 않는 이유는 `command/createPageCommand.ts` 상단에 적었다 —
   * 이미 있는 키가 오면 기존 화면을 덮어쓴다. 응답의 `createPage.pageId`는 이 값과 같아야 한다.
   */
  newPageId?: PageId;
  /**
   * 작업공간에 이미 가져온 이미지의 상대 경로(`assets/...`). **읽기 전용 문맥**이다 — 이 목록에
   * 있는 파일만 `src`로 쓸 수 있다는 뜻이고, 이미지 데이터를 응답에 넣으라는 뜻이 아니다.
   *
   * 실어 보내는 이유: 없으면 에이전트가 로컬 파일 경로를 짐작해 적고, 그 경로가 없는 파일이라
   * 미리보기·캔버스에 빈 상자만 남는다. 목록이 비면 필드 자체를 생략한다.
   */
  assets?: readonly string[];
}

export interface BuildNlRequestInput {
  /** GUI snapshot; omitted by older callers. Only destination metadata is serialized. */
  project?: ProjectSpec;
  id: string;
  instruction: string;
  scope: NlScope;
  pageId: PageId;
  page: ScreenSpec;
  /** 새 페이지 범위에서만 넘긴다. 다른 범위에서 넘어오면 요청에 싣지 않는다. */
  newPageId?: PageId;
  /** 작업공간 asset 경로. 파일을 읽는 호출부(`nlAgentClient.ts`)가 채운다. */
  assets?: readonly string[];
}

/** 요청 파일에 쓸 객체를 만든다. 순수 함수 — 파일을 쓰지 않는다. */
export function buildNlRequest(input: BuildNlRequestInput): NlRequest {
  const widgets = input.project ? buildWidgetSourceCatalog(input.project, input.page) : [];
  // newPageId는 범위가 새 페이지일 때만 싣는다 — 다른 범위에 실어 보내면 "이 응답으로 페이지를
  // 만들어도 된다"는 신호로 읽힐 수 있고, GUI는 그 범위에서 createPage를 받지 않는다.
  const newPageId = input.scope.kind === "newPage" ? input.newPageId : undefined;
  const assets = input.assets ?? [];
  return {
    protocol: NL_PROTOCOL_VERSION,
    commandVersion: COMMAND_VERSION,
    id: input.id,
    instruction: input.instruction,
    scope: input.scope,
    pageId: input.pageId,
    page: input.page,
    responsePath: NL_RESPONSE_PATH,
    ...(input.project ? { destinations: buildDestinationCatalog(input.project) } : {}),
    ...(widgets.length ? { widgets } : {}),
    ...(newPageId === undefined ? {} : { newPageId }),
    ...(assets.length ? { assets } : {}),
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
 * - `commands` — 화면 Command가 통과했다. G2·G3로 넘긴다.
 * - `projectCommand` — 닫힌 위젯 추출·다른 페이지 배치 명령. 프로젝트 검증으로 넘긴다.
 * - `createPage` — 새 프로젝트 페이지 한 장(#497). 같은 `projectCommand` 자리로 오지만 적용
 *   경로가 달라(`command/createPageCommand.ts`) 판정부터 갈라 둔다.
 */
export type NlResponseResult =
  | { kind: "stale" }
  | { kind: "malformed"; message: string }
  | { kind: "agentError"; message: string }
  | { kind: "invalid"; issues: CommandValidationIssue[] }
  | { kind: "commands"; commands: Command[] }
  | { kind: "projectCommand"; command: Extract<WidgetProjectCommand, { type: "extractAndPlaceWidget" }> }
  | { kind: "createPage"; command: CreatePageCommand };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * `createPage` 명령의 **형식**만 본다 — 새 페이지 스펙의 내용은 `applyCreatePageCommand`가
 * 후보 프로젝트로 검증한다. 여기서 보는 것은 "필드가 정확히 넷인가"다. 모르는 필드가 섞인
 * 명령을 통과시키면 다음 규약에서 그 필드에 뜻이 생겼을 때 조용히 다른 일을 하게 된다.
 *
 * `commandVersion`은 현재 값만 받는다 — 위젯 명령이 호환용 `"0.2"`를 함께 받는 것과 다르다.
 * 이 명령은 `"0.3"` 이후에 생겼으니 옛 생산자가 보낼 수 있는 값이 아니다.
 */
function parseCreatePage(body: Record<string, unknown>, command: Record<string, unknown>): NlResponseResult {
  const fields = ["version", "type", "pageId", "page"];
  if (body.commandVersion !== COMMAND_VERSION
    || Object.keys(command).length !== fields.length || fields.some((key) => !Object.hasOwn(command, key))
    || command.version !== "0.1"
    || typeof command.pageId !== "string" || command.pageId.trim() === ""
    || !isRecord(command.page)) {
    return { kind: "malformed", message: "새 페이지 생성 명령 형식이 올바르지 않습니다." };
  }
  return { kind: "createPage", command: command as unknown as CreatePageCommand };
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
      message: `응답 형식 버전이 다릅니다(기대: ${NL_PROTOCOL_VERSION}, 받음: ${JSON.stringify(body.protocol)}). GUI와 visual-spec skills를 업데이트하세요.`,
    };
  }

  if (typeof body.error === "string" && body.error !== "") {
    return { kind: "agentError", message: body.error };
  }

  if (Object.hasOwn(body, "projectCommand")) {
    const command = body.projectCommand;
    // 프로젝트 명령은 종류마다 적용 경로가 다르다. 먼저 종류로 갈라야 한쪽의 필드 검사가
    // 다른 쪽을 "모양이 틀렸다"로 거절하지 않는다.
    if (isRecord(command) && !Object.hasOwn(body, "commands") && command.type === "createPage") {
      return parseCreatePage(body, command);
    }
    const fields = ["version", "type", "pageId", "nodeId", "widgetId", "name", "targetPageId"];
    if ((body.commandVersion !== "0.2" && body.commandVersion !== COMMAND_VERSION) || Object.hasOwn(body, "commands") || !isRecord(command)
      || Object.keys(command).length !== fields.length || fields.some((key) => !Object.hasOwn(command, key))
      || command.version !== "0.1" || command.type !== "extractAndPlaceWidget"
      || [command.pageId, command.nodeId, command.widgetId, command.name, command.targetPageId]
        .some((value) => typeof value !== "string" || value.trim() === "")) {
      return { kind: "malformed", message: "프로젝트 위젯 명령 형식이 올바르지 않습니다." };
    }
    return { kind: "projectCommand", command: command as Extract<WidgetProjectCommand, { type: "extractAndPlaceWidget" }> };
  }

  // G1 — Command 배열의 형태 검사(#153). Transaction 모양으로 감싸서 넘긴다.
  const result = validateTransaction({ version: body.commandVersion, commands: body.commands });
  if (!result.valid) {
    return { kind: "invalid", issues: result.issues };
  }

  return { kind: "commands", commands: body.commands as Command[] };
}

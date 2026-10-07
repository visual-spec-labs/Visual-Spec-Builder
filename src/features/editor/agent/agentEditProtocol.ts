/**
 * 외부 에이전트 대화 ↔ 열린 GUI 교환 규약 (이슈 #279).
 *
 * 자연어 입력창 경로(#155, `nl/nlProtocol.ts`)는 **GUI에서 시작한 요청**에 에이전트가 답한다.
 * 이 규약은 반대 방향이다 — 사용자가 Claude Code·Codex 대화에서 바로 "버튼 색 바꿔줘"라고
 * 했을 때, 에이전트가 스펙 JSON 파일을 직접 고치면 열린 GUI는 그 사실을 모르고 미저장
 * 초안과 Undo도 어긋난다. 그래서 파일 대신 이 통로로 Command를 보내게 한다.
 *
 * - **읽기**: GUI가 `runtime/gui-state.json`에 지금 문서·페이지·선택·상태 버전을 공개한다.
 * - **쓰기**: 에이전트가 `runtime/agent-edit.json`에 Command 배열과 자기가 읽은 상태 버전
 *   (`baseStateRevision`)을 쓴다. GUI는 상태가 그대로일 때만 자연어 경로와 같은 관문
 *   (G1 형태 검사 → G2·G3 `applyGuardedTransaction`)으로 Undo 한 단계로 적용한다.
 * - **결과**: GUI가 `runtime/agent-edit-result.json`에 적용·거절과 이유를 쓴다. 서버는 이 파일을
 *   연결 잠금(`gui`)의 주인만 쓰게 한다 — 연결을 잃은 탭이 새 주인의 결과를 덮지 않게(PR #303 리뷰).
 *
 * 경로는 모두 `.visual-spec/` 기준이다(#278에서 확인한 혼동을 피하려고 필드로도 싣는다).
 * 이 파일은 순수하다 — 파일 입출력은 `ui/agentEditBridge.ts`가 맡는다.
 */

import { validateTransaction } from "@/features/editor/command/validate";
import type { Command } from "@/features/editor/command/types";
import type { CommandValidationIssue } from "@/features/editor/command/validate";
import type { PageId, ScreenSpec } from "@/features/editor/schema";
import { RUNTIME_DIR } from "@/features/workspace/protocol";

export const AGENT_EDIT_PROTOCOL_VERSION = 1;
export const GUI_STATE_FILE = "gui-state.json";
export const GUI_STATE_PATH = `${RUNTIME_DIR}/${GUI_STATE_FILE}`;
export const AGENT_EDIT_FILE = "agent-edit.json";
export const AGENT_EDIT_PATH = `${RUNTIME_DIR}/${AGENT_EDIT_FILE}`;
export const AGENT_EDIT_RESULT_PATH = `${RUNTIME_DIR}/agent-edit-result.json`;

/** GUI가 공개하는 현재 상태. 에이전트는 이걸 읽고 Command를 만든다. */
export interface GuiState {
  protocol: number;
  /** 이 상태를 공개한 GUI 탭. 탭을 닫으면 작업공간 잠금 해제와 함께 이 파일이 지워진다. */
  id: string;
  /**
   * 지금 문서·페이지·내용을 가리키는 값. 에이전트는 편집 요청에 그대로 돌려준다
   * (`baseStateRevision`). 그 사이 사용자가 편집했거나 다른 문서·페이지로 옮겼으면 값이
   * 달라져 GUI가 요청을 거절한다 — 낡은 화면을 기준으로 만든 Command를 적용하지 않는다.
   */
  stateRevision: string;
  /** 마지막으로 쓴 시각(ISO). GUI는 열려 있는 동안 주기적으로 갱신한다 — 오래됐으면 닫힌 것이다. */
  updatedAt: string;
  /** 열린 파일(`.visual-spec/specs/` 기준). 저장 전 새 문서면 null. */
  fileName: string | null;
  /** 열린 파일을 디스크에서 읽은 버전. 저장 전이면 null. */
  diskRevision: string | null;
  pageId: PageId;
  /** 선택한 노드. 없으면 null — "이 버튼"처럼 가리킬 때 쓴다. */
  selectedId: string | null;
  /** 활성 페이지의 현재 스펙 전체. 노드 id와 현재 값은 여기서 읽는다. */
  page: ScreenSpec;
  /** 편집 요청을 쓸 자리(`.visual-spec/` 기준). */
  editPath: string;
  /** 적용 결과가 쓰이는 자리(`.visual-spec/` 기준). */
  resultPath: string;
}

/** 32비트 FNV-1a 두 번(다른 seed) — 충돌 확률을 낮춘 짧은 지문. 보안용이 아니다. */
function fingerprint(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

export interface StateRevisionInput {
  /**
   * 이 GUI 탭(연결)의 고유 id. `documentId`는 탭마다 0부터 세므로 그것만으로는 다른 탭·나중
   * 세션의 같은 파일과 값이 겹친다 — 그러면 처리되지 않고 남은 옛 요청이 나중에 열린 GUI에서
   * 적용된다(#279 리뷰). 탭 id를 넣어 이 연결에서 읽은 상태에만 맞게 한다.
   */
  tabId: string;
  /** `editorStore.documentId` — 같은 탭에서 같은 내용이어도 다른 문서면 다른 값이 되게 한다. */
  documentId: number;
  fileName: string | null;
  pageId: PageId;
  page: ScreenSpec;
}

export function computeStateRevision({ tabId, documentId, fileName, pageId, page }: StateRevisionInput): string {
  return fingerprint(JSON.stringify([tabId, documentId, fileName, pageId, page]));
}

export function buildGuiState(
  input: StateRevisionInput & { diskRevision: string | null; selectedId: string | null; now: Date },
): GuiState {
  return {
    protocol: AGENT_EDIT_PROTOCOL_VERSION,
    id: input.tabId,
    stateRevision: computeStateRevision(input),
    updatedAt: input.now.toISOString(),
    fileName: input.fileName,
    diskRevision: input.diskRevision,
    pageId: input.pageId,
    selectedId: input.selectedId,
    page: input.page,
    editPath: AGENT_EDIT_PATH,
    resultPath: AGENT_EDIT_RESULT_PATH,
  };
}

export type AgentEditParse =
  /** 파일이 없거나 비어 있다. */
  | { kind: "none" }
  /** 요청 id를 읽을 수 없을 만큼 깨졌다 — 결과를 돌려줄 짝이 없다. */
  | { kind: "unreadable" }
  | { kind: "malformed"; id: string; message: string }
  | { kind: "invalid"; id: string; issues: CommandValidationIssue[] }
  | { kind: "edit"; id: string; baseStateRevision: string; pageId: PageId; commands: Command[]; summary: string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 에이전트가 쓴 편집 요청을 읽는다. 형태 검사(G1)까지 한다. 적용 가능 여부는 GUI가 본다. */
export function parseAgentEdit(text: string | null): AgentEditParse {
  if (text === null || text.trim() === "") return { kind: "none" };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { kind: "unreadable" };
  }
  if (!isRecord(body) || typeof body.id !== "string" || body.id === "") return { kind: "unreadable" };
  const id = body.id;
  if (body.protocol !== AGENT_EDIT_PROTOCOL_VERSION) {
    return { kind: "malformed", id, message: `요청 형식 버전이 다릅니다(기대: ${AGENT_EDIT_PROTOCOL_VERSION}, 받음: ${JSON.stringify(body.protocol)}).` };
  }
  if (typeof body.baseStateRevision !== "string" || body.baseStateRevision === "") {
    return { kind: "malformed", id, message: "baseStateRevision이 없습니다. gui-state.json의 stateRevision을 그대로 넣으세요." };
  }
  if (typeof body.pageId !== "string" || body.pageId === "") {
    return { kind: "malformed", id, message: "pageId가 없습니다. gui-state.json의 pageId를 그대로 넣으세요." };
  }
  if (body.summary !== undefined && typeof body.summary !== "string") {
    return { kind: "malformed", id, message: "summary는 문자열이어야 합니다." };
  }
  const result = validateTransaction({ commands: body.commands });
  if (!result.valid) return { kind: "invalid", id, issues: result.issues };
  return {
    kind: "edit", id, baseStateRevision: body.baseStateRevision, pageId: body.pageId,
    commands: body.commands as Command[], summary: typeof body.summary === "string" && body.summary !== "" ? body.summary : null,
  };
}

export type AgentEditStatus = "applied" | "rejected" | "invalid" | "pending";

/** GUI가 쓰는 결과. 에이전트는 자기 요청 id의 결과만 읽는다. */
export interface AgentEditResult {
  protocol: number;
  requestId: string;
  status: AgentEditStatus;
  message: string;
  /** 적용 뒤(또는 거절 시점) GUI 상태 버전. 이어서 요청하려면 gui-state.json을 다시 읽는다. */
  stateRevision: string | null;
}

export function buildAgentEditResult(requestId: string, status: AgentEditStatus, message: string, stateRevision: string | null): AgentEditResult {
  return { protocol: AGENT_EDIT_PROTOCOL_VERSION, requestId, status, message, stateRevision };
}

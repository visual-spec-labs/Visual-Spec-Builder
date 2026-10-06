import { create } from "zustand";

import type { Command } from "@/features/editor/command/types";
import type { PageId, ProjectSpec } from "@/features/editor/schema";

/**
 * 외부 에이전트 편집(#279)을 사용자에게 알리는 자리. 편집 자체는 editorStore가 하고, 여기는
 * "무엇이 적용·거절됐고 되돌릴 수 있는가"만 들고 있다 — 저장 충돌 상태(saveConflictStore)와
 * 같은 이유로 IR/Command 스토어와 분리한다.
 */
export type AgentEditNotice =
  | { kind: "applied"; requestId: string; message: string; spec: ProjectSpec }
  | { kind: "rejected"; requestId: string; message: string }
  | {
      /** 배경을 바꾸는 편집 — 자연어 입력창과 같이 적용 전에 확인받는다. */
      kind: "confirm"; requestId: string; message: string; names: string[];
      pageId: PageId; commands: Command[]; baseStateRevision: string;
    };

export const useAgentEditStore = create<{
  notice: AgentEditNotice | null;
  /** 이 탭이 지금 외부 에이전트와 연결된 GUI인가(작업공간에서 한 탭만). */
  connected: boolean;
  /** 확인 대기 중인 편집을 사용자가 적용·거절했을 때 브리지가 처리한다. */
  resolveConfirm: (accept: boolean) => void;
}>(() => ({ notice: null, connected: false, resolveConfirm: () => undefined }));

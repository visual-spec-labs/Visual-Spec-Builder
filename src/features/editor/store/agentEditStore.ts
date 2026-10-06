import { create } from "zustand";

import type { Command } from "@/features/editor/command/types";
import type { PageId, ProjectSpec } from "@/features/editor/schema";

/**
 * 외부 에이전트 편집과 열린 파일의 디스크 변경(#279)을 사용자에게 알리는 자리. 편집 자체는
 * editorStore가 하고, 여기는 "무엇이 적용·거절됐고 되돌릴 수 있는가"만 들고 있다 — 저장 충돌 상태(saveConflictStore)와
 * 같은 이유로 IR/Command 스토어와 분리한다.
 */
export type AgentEditNotice =
  | { kind: "applied"; requestId: string; message: string; spec: ProjectSpec }
  | { kind: "rejected"; requestId: string; message: string }
  | {
      /** 배경을 바꾸는 편집 — 자연어 입력창과 같이 적용 전에 확인받는다. */
      kind: "confirm"; requestId: string; message: string; names: string[];
      pageId: PageId; commands: Command[]; baseStateRevision: string;
    }
  /** 열린 파일이 디스크에서 바뀌어 불러왔다(미저장 편집 없음) — Undo로 되돌릴 수 있다. */
  | { kind: "diskImported"; fileName: string; spec: ProjectSpec }
  /** 열린 파일이 디스크에서 바뀌었는데 미저장 편집이 있다 — 불러올지 묻는다. */
  | { kind: "diskChanged"; fileName: string; revision: string; spec: ProjectSpec }
  /** 디스크의 새 내용이 검증에 실패해 불러오지 않았다. */
  | { kind: "diskInvalid"; fileName: string; issueCount: number };

export const useAgentEditStore = create<{
  notice: AgentEditNotice | null;
  /** 이 탭이 지금 외부 에이전트와 연결된 GUI인가(작업공간에서 한 탭만). */
  connected: boolean;
  /** 확인 대기 중인 편집을 사용자가 적용·거절했을 때 브리지가 처리한다. */
  resolveConfirm: (accept: boolean) => void;
  /** 디스크 변경을 불러올지(true) 내 편집을 유지할지(false) 정했을 때 감시기가 처리한다. */
  resolveDiskChange: (load: boolean) => void;
}>(() => ({ notice: null, connected: false, resolveConfirm: () => undefined, resolveDiskChange: () => undefined }));

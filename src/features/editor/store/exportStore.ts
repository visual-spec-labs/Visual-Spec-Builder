import { create } from "zustand";

import type { PageId, ScreenSpec } from "@/features/editor/schema";
import type { FreshnessReport } from "@/features/editor/export/generationManifest";
import type { GeneratedFile, VerifyReport } from "@/features/editor/export/verifyGenerated";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { scanGeneratedCode } from "@/features/editor/ui/exportGeneratedCode";

/**
 * `idle` 은 아직 한 번도 훑지 않은 상태다. `no-workspace` 를 `ready` 의 한 경우로
 * 접지 않는 이유는 `exportGeneratedCode.ts` 의 `GeneratedScan` 주석과 같다 —
 * 사용자가 해야 할 일이 다르다.
 */
export type ExportStatus = "idle" | "scanning" | "ready" | "no-workspace" | "unsupported";

/** 검사와 ZIP 다운로드가 함께 사용하는 편집기 스냅샷. */
export interface ExportTarget {
  documentId: number;
  pageId: PageId;
  page: ScreenSpec;
  projectName: string;
}

interface ExportState {
  isOpen: boolean;
  status: ExportStatus;
  files: GeneratedFile[];
  report: VerifyReport | null;
  /** 생성 세대 확인(#284). 파일·참조 검사(`report`)와 별개의 판정이다. */
  freshness: FreshnessReport | null;
  target: ExportTarget | null;
  /** 패널을 열고 곧바로 훑는다. */
  open: (target: ExportTarget) => Promise<void>;
  /** "다시 검사". 패널은 그대로 두고 결과만 갱신한다. */
  rescan: (target: ExportTarget) => Promise<void>;
  close: () => void;
}

/**
 * GUI의 코드 Export 패널 상태(#157).
 *
 * ticketStore와 같은 이유로 editorStore에 넣지 않는다 — 훑기 결과는 IR도 Undo
 * 대상도 아니고 작업공간 파일에서 파생된 값이다.
 */
let generation = 0;

function clearResult(): Pick<ExportState, "status" | "files" | "report" | "freshness" | "target"> {
  return { status: "idle", files: [], report: null, freshness: null, target: null };
}

export const useExportStore = create<ExportState>((set) => {
  async function run(target: ExportTarget): Promise<void> {
    const runGeneration = ++generation;
    set({ status: "scanning", files: [], report: null, freshness: null, target });
    const scan = await scanGeneratedCode(target.page, target.pageId);
    if (runGeneration !== generation) return;
    if (scan.kind === "no-workspace" || scan.kind === "unsupported") {
      set({ status: scan.kind, files: [], report: null, freshness: null, target });
      return;
    }
    set({ status: "ready", files: scan.files, report: scan.report, freshness: scan.freshness, target });
  }

  return {
    isOpen: false,
    status: "idle",
    files: [],
    report: null,
    freshness: null,
    target: null,
    open: async (target) => {
      set({ isOpen: true });
      await run(target);
    },
    rescan: run,
    close: () => {
      generation += 1;
      set({ isOpen: false, ...clearResult() });
    },
  };
});

// 편집·페이지 전환·문서 전환은 기존 결과와 진행 중인 응답을 무효화한다(#272).
// 패널은 계속 열어 두어 사용자가 현재 페이지로 다시 검사할 수 있게 한다.
useEditorStore.subscribe((next, previous) => {
  if (
    next.documentId !== previous.documentId ||
    next.activePageId !== previous.activePageId ||
    next.spec !== previous.spec
  ) {
    generation += 1;
    useExportStore.setState(clearResult());
  }
});

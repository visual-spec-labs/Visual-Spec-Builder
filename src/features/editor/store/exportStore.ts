import { create } from "zustand";

import type { ScreenSpec } from "@/features/editor/schema";
import type { GeneratedFile, VerifyReport } from "@/features/editor/export/verifyGenerated";
import { scanGeneratedCode } from "@/features/editor/ui/exportGeneratedCode";

/**
 * `idle` 은 아직 한 번도 훑지 않은 상태다. `no-workspace` 를 `ready` 의 한 경우로
 * 접지 않는 이유는 `exportGeneratedCode.ts` 의 `GeneratedScan` 주석과 같다 —
 * 사용자가 해야 할 일이 다르다.
 */
export type ExportStatus = "idle" | "scanning" | "ready" | "no-workspace";

interface ExportState {
  isOpen: boolean;
  status: ExportStatus;
  files: GeneratedFile[];
  report: VerifyReport | null;
  /** 패널을 열고 곧바로 훑는다. */
  open: (page: ScreenSpec) => Promise<void>;
  /** "다시 검사". 패널은 그대로 두고 결과만 갱신한다. */
  rescan: (page: ScreenSpec) => Promise<void>;
  close: () => void;
}

/**
 * GUI의 코드 Export 패널 상태(#157).
 *
 * ticketStore와 같은 이유로 editorStore에 넣지 않는다 — 훑기 결과는 IR도 Undo
 * 대상도 아니고 작업공간 파일에서 파생된 값이다.
 */
export const useExportStore = create<ExportState>((set) => {
  async function run(page: ScreenSpec): Promise<void> {
    set({ status: "scanning" });
    const scan = await scanGeneratedCode(page);
    if (scan.kind === "no-workspace") {
      set({ status: "no-workspace", files: [], report: null });
      return;
    }
    set({ status: "ready", files: scan.files, report: scan.report });
  }

  return {
    isOpen: false,
    status: "idle",
    files: [],
    report: null,
    open: async (page) => {
      set({ isOpen: true });
      await run(page);
    },
    rescan: run,
    close: () => set({ isOpen: false }),
  };
});

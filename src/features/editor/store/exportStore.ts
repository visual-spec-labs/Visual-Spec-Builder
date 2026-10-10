import { create } from "zustand";

import type { PageId, ScreenSpec } from "@/features/editor/schema";
import type { FreshnessReport } from "@/features/editor/export/generationManifest";
import type { GeneratedFile, VerifyReport } from "@/features/editor/export/verifyGenerated";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { scanGeneratedCode, type GeneratedLocation } from "@/features/editor/ui/exportGeneratedCode";

/**
 * `idle` 은 아직 한 번도 훑지 않은 상태다. `no-workspace` 를 `ready` 의 한 경우로
 * 접지 않는 이유는 `exportGeneratedCode.ts` 의 `GeneratedScan` 주석과 같다 —
 * 사용자가 해야 할 일이 다르다.
 */
export type ExportStatus = "idle" | "scanning" | "ready" | "no-workspace" | "unsupported" | "unavailable";

/** 검사와 ZIP 다운로드가 함께 사용하는 편집기 스냅샷. */
export interface ExportTarget {
  documentId: number;
  pageId: PageId;
  page: ScreenSpec;
  projectName: string;
  /** 작업공간 파일 이름(#281). 생성 자리(`generated/<프로젝트 폴더>/<PageId>/`)를 찾는 데 쓴다. */
  fileName: string | null;
}

interface ExportState {
  isOpen: boolean;
  status: ExportStatus;
  files: GeneratedFile[];
  report: VerifyReport | null;
  /** 생성 세대 확인(#284). 파일·참조 검사(`report`)와 별개의 판정이다. */
  freshness: FreshnessReport | null;
  /** 훑은 생성 자리(#281). */
  location: GeneratedLocation | null;
  target: ExportTarget | null;
  /** `unavailable`(생성 기록을 확인하지 못함, #281 리뷰)일 때의 이유. */
  unavailableMessage: string | null;
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

function clearResult(): Pick<ExportState, "status" | "files" | "report" | "freshness" | "location" | "target" | "unavailableMessage"> {
  return { status: "idle", files: [], report: null, freshness: null, location: null, target: null, unavailableMessage: null };
}

export const useExportStore = create<ExportState>((set) => {
  async function run(target: ExportTarget): Promise<void> {
    const runGeneration = ++generation;
    set({ status: "scanning", files: [], report: null, freshness: null, location: null, target, unavailableMessage: null });
    const scan = await scanGeneratedCode(target.page, target.pageId, {
      fileName: target.fileName,
      documentId: target.documentId,
    });
    if (runGeneration !== generation) return;
    if (scan.kind === "no-workspace" || scan.kind === "unsupported") {
      set({ status: scan.kind, files: [], report: null, freshness: null, location: null, target });
      return;
    }
    if (scan.kind === "unavailable") {
      set({ status: "unavailable", files: [], report: null, freshness: null, location: null, target, unavailableMessage: scan.message });
      return;
    }
    set({
      status: "ready",
      files: scan.files,
      report: scan.report,
      freshness: scan.freshness,
      location: scan.location,
      target,
    });
  }

  return {
    isOpen: false,
    status: "idle",
    files: [],
    report: null,
    freshness: null,
    location: null,
    target: null,
    unavailableMessage: null,
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

function invalidate(): void {
  generation += 1;
  useExportStore.setState(clearResult());
}

// 편집·페이지 전환·문서 전환은 기존 결과와 진행 중인 응답을 무효화한다(#272).
// 패널은 계속 열어 두어 사용자가 현재 페이지로 다시 검사할 수 있게 한다.
useEditorStore.subscribe((next, previous) => {
  if (
    next.documentId !== previous.documentId ||
    next.activePageId !== previous.activePageId ||
    next.spec !== previous.spec
  ) invalidate();
});

// 훑기 결과는 파일 이름에서 찾은 프로젝트의 생성 자리에 묶여 있다(#281). 다른 이름으로 저장하면 문서 ID·스펙은
// 그대로라 위 구독이 못 잡는다 — 파일 이름이나 프로젝트 신원이 바뀌면 결과를 지운다(#281 리뷰).
useDocumentStore.subscribe((next, previous) => {
  if (next.fileName !== previous.fileName || next.projectIdentity !== previous.projectIdentity) invalidate();
});

/**
 * 이 검사 결과가 아직 지금 문서·페이지·프로젝트의 것인가. ZIP을 내려받기 직전에 다시 본다(#281 리뷰) — 구독이
 * 결과를 지우기 전에 이미 시작한 다운로드나, 결과가 남아 있는 화면에서 누른 다운로드가 다른 프로젝트의 파일을
 * 내려받지 않게 한다.
 */
export function isExportTargetCurrent(target: ExportTarget): boolean {
  const { status, target: scanned } = useExportStore.getState();
  const { documentId, activePageId, spec } = useEditorStore.getState();
  return status === "ready" && scanned === target && target.documentId === documentId &&
    target.pageId === activePageId && target.page === spec.pages[activePageId] &&
    target.fileName === useDocumentStore.getState().fileName;
}

import { create } from "zustand";
import type { ProjectSpec } from "@/features/editor/schema";
import type { PauseReason } from "./saveConflictStore";

/** 표시용 관측값. 저장 권한·전환 판단에 사용하거나 IR에 직렬화하지 않는다. */
export interface DiskObservation {
  documentId: number;
  fileName: string;
  revision: string | null;
  json: string | null;
}
export interface DraftObservation {
  documentId: number;
  spec: ProjectSpec;
  fileName: string | null;
  shared: boolean;
  session: boolean;
  owner: "pending" | "owned" | "blocked" | "unavailable";
}
export interface SaveAttempt {
  documentId: number;
  spec: ProjectSpec;
  phase: "saving" | "failed" | "downloaded";
}
export const usePersistenceStatusStore = create<{
  disk: DiskObservation | null;
  draft: DraftObservation | null;
  attempt: SaveAttempt | null;
}>(() => ({ disk: null, draft: null, attempt: null }));

export function persistenceLabels(input: {
  documentId: number; fileName: string | null; diskRevision: string | null;
  spec: ProjectSpec; json: string;
  disk: DiskObservation | null; draft: DraftObservation | null; attempt: SaveAttempt | null;
  paused: boolean; reason: PauseReason;
}) {
  const { documentId, fileName, diskRevision, spec, json, paused, reason } = input;
  const disk = input.disk?.documentId === documentId && input.disk.fileName === fileName ? input.disk : null;
  const draft = input.draft?.documentId === documentId && input.draft.fileName === fileName && input.draft.spec === spec ? input.draft : null;
  const attempt = input.attempt?.documentId === documentId ? input.attempt : null;
  let file = "파일 저장 미확인";
  let fileHelp = "파일명만으로 저장을 판단하지 않습니다. 디스크 내용을 확인하지 못했습니다.";
  if (fileName === null) {
    file = "파일 미저장"; fileHelp = "이름 없는 문서입니다. 파일 → 저장으로 작업공간 파일에 저장하세요.";
  } else if (disk?.json !== null && disk?.json !== undefined) {
    if (disk.revision !== diskRevision) {
      file = "외부 파일 변경"; fileHelp = "디스크 버전이 달라졌습니다. 불러오기 또는 충돌 해결이 필요합니다.";
    } else if (disk.json === json) {
      file = "파일 저장됨"; fileHelp = "마지막으로 확인한 작업공간 파일의 내용과 현재 문서가 같습니다.";
    } else {
      file = "수정됨 · 파일 미저장"; fileHelp = "현재 내용이 확인된 파일 내용과 다릅니다. 파일 → 저장으로 저장하세요.";
    }
  }
  if (attempt?.phase === "saving") { file = "파일 저장 중"; fileHelp = "저장 응답을 기다립니다. 완료 전에는 저장된 것으로 표시하지 않습니다."; }
  if (attempt?.phase === "failed") { file = "파일 저장 실패"; fileHelp = "저장에 실패했습니다. 현재 내용과 브라우저 보관 상태를 확인하고 파일 → 저장 또는 파일 → JSON 내보내기를 사용하세요."; }
  if (attempt?.phase === "downloaded" && attempt.spec === spec) { file = "다운로드 요청됨"; fileHelp = "브라우저 다운로드를 요청했습니다. 실제 파일 저장 완료는 확인할 수 없습니다."; }
  if (paused) {
    file = reason === "draft" ? "초안 선택 필요" : "충돌 · 저장 중단";
    fileHelp = reason === "draft" ? "연 파일과 브라우저 초안 중 사용할 내용을 선택하세요." : "다른 탭 또는 디스크 변경과 충돌했습니다. 충돌 창에서 내용을 확인하세요.";
  }
  let browser = "초안 보관 확인 중";
  let draftHelp = "브라우저 초안 보관은 디스크 파일 저장과 다릅니다.";
  if (draft?.owner === "blocked" && fileName === null) {
    browser = "다른 탭 사용 중"; draftHelp = "이 초안의 소유권이 없습니다. 소유 탭을 닫은 뒤 Home에서 이어서 열기를 다시 시도하세요.";
  } else if (draft?.shared) {
    browser = "브라우저 초안 보관됨"; draftHelp = "현재 내용이 브라우저 보관본과 같습니다. 브라우저 데이터 삭제 시 사라질 수 있으며 디스크 파일 저장은 아닙니다.";
  } else if (draft?.session) {
    browser = "현재 탭에만 보관"; draftHelp = file === "파일 저장됨"
      ? "탭 복구본을 기록했습니다. 현재 내용은 확인된 작업공간 파일에도 있습니다."
      : "현재 탭 복구본만 기록했습니다. 공유 초안 보관은 아직 확인되지 않았습니다. 파일 미저장 내용은 탭을 닫기 전에 파일 → 저장 또는 파일 → JSON 내보내기를 사용하세요.";
  } else if (draft) {
    browser = "초안 보관 실패"; draftHelp = "현재 내용의 브라우저 보관을 확인하지 못했습니다. 이 탭을 닫지 말고 파일 → 저장 또는 파일 → JSON 내보내기로 보존하세요.";
  }
  return { file, fileHelp, browser, draftHelp };
}

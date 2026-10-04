import { migrateV01 } from "@/features/editor/schema";
import { parseSpecJson } from "@/features/editor/store/loadSpec";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { projectStorageKey, publishProjectRename } from "@/features/editor/store/specStorage";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { projectFileName } from "@/features/workspace/projectName";
import { WORKSPACE_MARKER_HEADER, WORKSPACE_RENAME_ROUTE } from "@/features/workspace/protocol";
import { readWorkspaceTextFile, type WriteResult } from "./workspaceClient";

/** Rename disk metadata first. A rejected/uncertain request never changes the in-memory draft. */
export async function renameProject(fileName: string, name: string): Promise<WriteResult> {
  const nextFileName = projectFileName(name);
  if (nextFileName === null) return { ok: false, error: "이름은 1~120자로, 경로 구분자나 파일명에 쓸 수 없는 문자를 제외하고 입력하세요." };
  if (typeof navigator === "undefined" || !navigator.locks) {
    return { ok: false, error: "이 브라우저에서는 안전한 탭 간 파일 이름 변경을 지원하지 않습니다. Web Locks를 지원하는 브라우저를 사용하세요. 원본과 메모리 작업은 보존했습니다." };
  }
  // Share the exact lock identities used by Save/autosave. Deterministic ordering
  // avoids opposing A->B/B->A requests deadlocking; same-path rename takes one lock.
  const keys = [...new Set([fileName, nextFileName].map((file) => projectStorageKey(file, "")))].sort();
  const withLocks = async (index: number): Promise<WriteResult> => index === keys.length
    ? renameLocked(fileName, name, nextFileName)
    : await navigator.locks.request(keys[index], () => withLocks(index + 1));
  try { return await withLocks(0); }
  catch { return { ok: false, error: "이름 변경을 위한 저장 잠금을 얻지 못했습니다. 원본과 메모리 작업은 보존했습니다." }; }
}

async function renameLocked(fileName: string, name: string, nextFileName: string): Promise<WriteResult> {
  if (useDocumentStore.getState().fileName === fileName &&
    (useSaveConflictStore.getState().paused || useSaveConflictStore.getState().check())) {
    return { ok: false, error: "다른 탭과의 저장 충돌을 먼저 해결하세요. 원본과 내 작업은 보존했습니다." };
  }
  const expectedText = await readWorkspaceTextFile(`specs/${fileName}`);
  if (expectedText === null) return { ok: false, error: "원본 파일을 읽을 수 없습니다. 목록을 새로 불러오세요." };
  const parsed = parseSpecJson(expectedText);
  if (!parsed.ok) return { ok: false, error: "유효한 프로젝트 파일이 아닙니다." };
  const renamedDiskSpec = "screen" in parsed.spec
    ? migrateV01({ ...parsed.spec, screen: { ...parsed.spec.screen, name } })
    : { ...parsed.spec, name };
  try {
    const response = await fetch(WORKSPACE_RENAME_ROUTE, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName, name, expectedText }),
    });
    const payload: unknown = await response.json();
    if (response.headers.get(WORKSPACE_MARKER_HEADER) !== "1" || !response.ok ||
      typeof payload !== "object" || payload === null || !("ok" in payload) || payload.ok !== true ||
      !("path" in payload) || payload.path !== `specs/${nextFileName}`) {
      const error = typeof payload === "object" && payload !== null && "error" in payload ? payload.error : null;
      return { ok: false, error: typeof error === "string" ? error : "이름 변경을 확인할 수 없습니다. 목록을 새로 불러오세요." };
    }
    publishProjectRename(fileName, renamedDiskSpec, nextFileName);
    if (useDocumentStore.getState().fileName === fileName) {
      useSaveConflictStore.getState().adoptRename(() => {
        useEditorStore.getState().renameProject(name);
        useDocumentStore.getState().setFileName(nextFileName);
      });
    }
    return { ok: true, path: `specs/${nextFileName}` };
  } catch {
    return { ok: false, error: "이름 변경 결과를 확인할 수 없습니다. 메모리 작업은 보존했습니다. 목록을 새로 불러와 실제 파일명을 확인하세요." };
  }
}

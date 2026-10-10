import { migrateV01 } from "@/features/editor/schema";
import { parseSpecJson } from "@/features/editor/store/loadSpec";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { projectStorageKey, prepareProjectRename, publishProjectRename } from "@/features/editor/store/specStorage";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { projectFileName } from "@/features/workspace/projectName";
import { WORKSPACE_MARKER_HEADER, WORKSPACE_RENAME_ROUTE, WORKSPACE_REVISION_HEADER } from "@/features/workspace/protocol";
import { recordProjectRename } from "./generationTarget";
import { readWorkspaceSpecSnapshot, type WriteResult } from "./workspaceClient";

/**
 * 이름 변경 결과. 성공해도 `warning`이 있으면 생성 기록(#281)에 이름 변경을 남기지 못한 것이다 — 이름 변경은
 * 끝났지만 사용자가 복구 경로(다음 전달 때 다시 기록)를 알아야 한다(`recordProjectRename`).
 */
export type RenameProjectResult = WriteResult | { ok: true; path: string; revision?: string; warning: string };

/** Rename disk metadata first. A rejected/uncertain request never changes the in-memory draft. */
export async function renameProject(fileName: string, name: string): Promise<RenameProjectResult> {
  const nextFileName = projectFileName(name);
  if (nextFileName === null) return { ok: false, error: "이름은 1~120자이며 확장자 포함 UTF-8 255바이트 이내로, 경로 구분자나 파일명에 쓸 수 없는 문자를 제외하고 입력하세요." };
  if (typeof navigator === "undefined" || !navigator.locks) {
    return { ok: false, error: "이 브라우저에서는 안전한 탭 간 파일 이름 변경을 지원하지 않습니다. Web Locks를 지원하는 브라우저를 사용하세요. 원본과 메모리 작업은 보존했습니다." };
  }
  // Share the exact lock identities used by Save/autosave. Deterministic ordering
  // avoids opposing A->B/B->A requests deadlocking; same-path rename takes one lock.
  const keys = [...new Set([fileName, nextFileName].map((file) => projectStorageKey(file, "")))].sort();
  const withLocks = async (index: number): Promise<RenameProjectResult> => index === keys.length
    ? renameLocked(fileName, name, nextFileName)
    : await navigator.locks.request(keys[index], () => withLocks(index + 1));
  try { return await withLocks(0); }
  catch { return { ok: false, error: "이름 변경을 위한 저장 잠금을 얻지 못했습니다. 원본과 메모리 작업은 보존했습니다." }; }
}

async function renameLocked(fileName: string, name: string, nextFileName: string): Promise<RenameProjectResult> {
  if (useDocumentStore.getState().fileName === fileName &&
    (useSaveConflictStore.getState().paused || useSaveConflictStore.getState().check())) {
    return { ok: false, error: "다른 탭과의 저장 충돌을 먼저 해결하세요. 원본과 내 작업은 보존했습니다." };
  }
  const snapshot = await readWorkspaceSpecSnapshot(`specs/${fileName}`);
  if (snapshot === null) return { ok: false, error: "원본 파일을 읽을 수 없습니다. 목록을 새로 불러오세요." };
  const currentDocument = useDocumentStore.getState();
  if (currentDocument.fileName === fileName && currentDocument.diskRevision !== snapshot.revision) {
    return { ok: false, error: "현재 초안의 원본 파일이 변경되었거나 저장 버전을 확인할 수 없습니다. 초안을 별도로 보존하고 파일을 다시 여세요." };
  }
  const expectedText = snapshot.text;
  const parsed = parseSpecJson(expectedText);
  if (!parsed.ok) return { ok: false, error: "유효한 프로젝트 파일이 아닙니다." };
  const renamedDiskSpec = "screen" in parsed.spec
    ? migrateV01({ ...parsed.spec, screen: { ...parsed.spec.screen, name } })
    : { ...parsed.spec, name };
  let rollback: () => void;
  try { rollback = prepareProjectRename(fileName, renamedDiskSpec, nextFileName); }
  catch { return { ok: false, error: "탭 간 이름 변경 알림을 저장할 공간이 없습니다. 원본과 메모리 작업은 보존했습니다." }; }
  try {
    const response = await fetch(WORKSPACE_RENAME_ROUTE, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName, name, expectedText }),
    });
    const payload: unknown = await response.json();
    if (response.headers.get(WORKSPACE_MARKER_HEADER) !== "1" || !response.ok ||
      typeof payload !== "object" || payload === null || !("ok" in payload) || payload.ok !== true ||
      !("path" in payload) || payload.path !== `specs/${nextFileName}`) {
      // Only confirmed rejections can release the barrier. Network/server failures
      // may have committed the rename, so retain it until the user verifies disk.
      if (response.headers.get(WORKSPACE_MARKER_HEADER) === "1" && response.status >= 400 && response.status < 500) rollback();
      const error = typeof payload === "object" && payload !== null && "error" in payload ? payload.error : null;
      return { ok: false, error: typeof error === "string" ? error : "이름 변경을 확인할 수 없습니다. 목록을 새로 불러오세요." };
    }
    const revision = response.headers.get(WORKSPACE_REVISION_HEADER);
    if (!revision || !/^[a-f0-9]{64}$/.test(revision)) {
      return { ok: false, error: "이름 변경 파일의 저장 버전을 확인할 수 없습니다. 메모리 작업을 보존했습니다. 파일을 다시 열어 확인하세요." };
    }
    publishProjectRename(fileName, renamedDiskSpec, nextFileName, revision);
    // 생성 출력의 주인(#281): 같은 프로젝트 ID·출력 폴더가 새 이름을 이어받는다. 기록하지 못해도 이름 변경은
    // 이미 끝났다 — 결과를 뒤집지 않고 이유와 복구 경로(다음 전달 때 다시 기록)를 사용자에게 알린다(#281 리뷰).
    const recordWarning = await recordProjectRename(fileName, nextFileName);
    if (useDocumentStore.getState().fileName === fileName) {
      useSaveConflictStore.getState().adoptRename(() => {
        useEditorStore.getState().renameProject(name);
        // 같은 프로젝트다 — 진행 중인 티켓 요청·Export 결과의 프로젝트 신원을 바꾸지 않는다.
        useDocumentStore.getState().adoptRenamedFileName(nextFileName, revision);
      });
    }
    return recordWarning === null
      ? { ok: true, path: `specs/${nextFileName}` }
      : { ok: true, path: `specs/${nextFileName}`, warning: recordWarning };
  } catch {
    useSaveConflictStore.getState().check();
    return { ok: false, error: "이름 변경 결과를 확인할 수 없습니다. 메모리 작업은 보존했습니다. 목록을 새로 불러와 실제 파일명을 확인하세요." };
  }
}

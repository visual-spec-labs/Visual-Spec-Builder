import { migrateV01, type ProjectSpec } from "@/features/editor/schema";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { parseSpecJson } from "@/features/editor/store/loadSpec";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { SPEC_DIR } from "@/features/workspace/protocol";
import { listWorkspaceFileEntries, readWorkspaceSpecSnapshot } from "./workspaceClient";

/** `specs/` 파일 하나를 카드에 쓸 수 있게 정규화한 것. */
export interface HomeProject {
  fileName: string;
  spec: ProjectSpec;
  diskRevision?: string;
}

/** 파일 하나를 읽어 ProjectSpec으로 정규화한다. 못 읽거나 검증에 실패하면 null. */
async function loadHomeProject(fileName: string): Promise<HomeProject | null> {
  const snapshot = await readWorkspaceSpecSnapshot(`${SPEC_DIR}/${fileName}`);
  if (snapshot === null) return null;

  const result = parseSpecJson(snapshot.text);
  if (!result.ok) return null;

  const spec = "screen" in result.spec ? migrateV01(result.spec) : result.spec;
  return { fileName, spec, diskRevision: snapshot.revision };
}

/**
 * `specs/`의 프로젝트 전부를 읽는다. 작업공간이 없으면 null(호출자가 메모리 spec
 * 한 장으로 되돌아간다). 있으면 배열이다(비어 있을 수 있다 — 그때가 상태 2).
 */
export async function loadWorkspaceProjects(): Promise<HomeProject[] | null> {
  const entries = await listWorkspaceFileEntries(SPEC_DIR);
  if (entries === null) return null;

  // Promise.all이 입력 순서를 유지하므로 읽기 속도가 달라도 카드 순서는 같다.
  const ordered = [...entries].sort((a, b) =>
    b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name),
  );
  const loaded = await Promise.all(ordered.map((entry) => loadHomeProject(entry.name)));
  return loaded.filter((project): project is HomeProject => project !== null);
}

/**
 * 홈 카드 하나를 연다. 카드는 목록을 만들 때 이미 내용을 읽어 뒀다 — 다시 읽지 않고
 * 그 spec을 그대로 loadSpec에 넘긴다. setFileName으로 "지금 연 파일"을 기억시켜야
 * 그 뒤의 File ▸ Save가 이 파일에 그대로 쓴다(documentStore.ts, 이슈 #185).
 *
 * 갈아 끼우기 전에 현재 문서의 대기 중 자동저장을 먼저 끝내고, 지금 파일을 다시 여는
 * 경우 남은 초안을 비교하게 파일명을 넘긴다(#267). false면 현재 문서를 그대로 둔다.
 */
export async function openHomeProject(project: HomeProject): Promise<boolean> {
  if (!await useSaveConflictStore.getState().settle(project.fileName)) return false;
  useEditorStore.getState().loadSpec(project.spec);
  useDocumentStore.getState().setFileName(project.fileName, project.diskRevision);
  return true;
}


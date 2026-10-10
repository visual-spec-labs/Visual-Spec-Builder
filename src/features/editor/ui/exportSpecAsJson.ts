import { useEditorStore } from "@/features/editor/store/editorStore";
import { usePersistenceStatusStore, type SaveAttempt } from "@/features/editor/store/persistenceStatusStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import type { ProjectSpec } from "@/features/editor/schema";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import {
  buildExportPayload,
  resolveFilename,
  type ExportResult,
} from "@/features/editor/store/exportSpec";
import { promptText } from "@/features/editor/store/promptDialogStore";
import {
  isWorkspaceAvailable,
  writeWorkspaceFile,
} from "@/features/editor/ui/workspaceClient";
import { SPEC_DIR, WORKSPACE_MISSING_REVISION } from "@/features/workspace/protocol";

/**
 * 브라우저 다운로드를 트리거하는 UI 레이어 래퍼(DOM 부수효과).
 * 검증(buildExportPayload)은 store에 두고 순수하게 테스트하며,
 * document/Blob/URL을 쓰는 이 파일은 DOM lib이 있는 ui/ 아래에만 둔다.
 *
 * export 전용이 아니다(#288) — `homeProjects.ts`가 검증에 실패한 파일의 원본
 * 텍스트를 사용자가 내려받게 할 때도 이 함수를 쓴다. 그래서 이름이 json이 아니라
 * text다 — 검증을 통과한 JSON만 담는다는 보장이 없다.
 */
export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * 스펙을 검증 후 JSON 파일로 내보낸다. 검증 실패 시 다운로드하지 않는다.
 *
 * File ▸ Export 전용이다 — Save와 달리 **작업공간이 아니라 브라우저 다운로드**로
 * 남긴다(이슈 #133). 스펙을 저장소 밖으로 꺼내는 건 여전히 이 경로다.
 * `.visual-spec/generated/`로 나가는 React 코드 Export는 별도 작업이다.
 */
export function exportSpecAsJson(spec: ProjectSpec): ExportResult {
  const result = buildExportPayload(spec);
  if (result.ok) {
    downloadTextFile(result.filename, result.json);
  } else {
    const details = result.issues.slice(0, 3).map((issue) => `${issue.path}: ${issue.message}`);
    const remaining = result.issueCount > 3 ? `\n외 ${result.issueCount - 3}건` : "";
    window.alert(`내보낼 수 없습니다 (검증 실패 ${result.issueCount}건).\n${details.join("\n")}${remaining}`);
  }
  return result;
}

/**
 * 스펙을 `.visual-spec/specs/<파일명>`에 쓴다(이슈 #133).
 *
 * 작업공간이 없으면(개발 서버 미들웨어 없는 빌드 결과물 등) 예전처럼 브라우저
 * 다운로드로 되돌아간다 — 저장 수단이 아예 사라지는 것보다 낫다.
 *
 * **성공해도 알린다.** 예전엔 브라우저가 다운로드 UI를 보여줘서 저장됐다는 신호가
 * 있었는데, 작업공간에 쓰면 화면에 아무 변화가 없다. 이 저장소엔 토스트 같은 알림
 * 자리가 아직 없어 alert가 유일한 통로다(실패만 알리면 "눌렀는데 아무 일도 안
 * 일어났다"와 구분이 안 된다).
 *
 * **성공 여부를 돌려준다**(PR #145 리뷰) — 호출 측이 그걸 보고 현재 문서 이름을
 * 갱신한다. 실패한 저장으로 이름을 바꾸면 그 뒤의 Save가 한 번도 써 본 적 없는
 * 파일을 향한다. 다운로드로 되돌아간 경우도 성공으로 친다(파일은 남았다).
 */
async function saveToWorkspace(filename: string, json: string, isCurrent: () => boolean): Promise<{ revision: string | null; downloaded?: boolean } | null> {
  if (!(await isWorkspaceAvailable())) {
    if (!isCurrent()) return null;
    downloadTextFile(filename, json);
    return { revision: null, downloaded: true };
  }

  if (!isCurrent() || useSaveConflictStore.getState().paused || useSaveConflictStore.getState().check()) return null;
  const relativePath = `${SPEC_DIR}/${filename}`;
  const document = useDocumentStore.getState();
  const expectedRevision = filename === document.fileName ? document.diskRevision : WORKSPACE_MISSING_REVISION;
  if (expectedRevision === null) {
    window.alert("저장 기준을 확인할 수 없습니다. 초안을 파일 → JSON 내보내기로 보존한 뒤 작업공간 파일을 다시 열거나 새 파일명으로 저장하세요.");
    return null;
  }
  let revision: string | null = null;
  const saved = await useSaveConflictStore.getState().save(filename, json, async () => {
    if (!isCurrent()) return false;
    const written = await writeWorkspaceFile(relativePath, json, "application/json", expectedRevision);
    if (!written.ok) {
      if (isCurrent() && (written.status === 409 || written.status === 428)) useSaveConflictStore.getState().pause(true);
      window.alert(`저장할 수 없습니다: ${written.error}`);
      return false;
    }
    revision = written.revision ?? null;
    window.alert(`저장했습니다 — .visual-spec/${written.path}`);
    return true;
  });
  return saved ? { revision } : null;
}

/** 기존 저장 판단은 유지하고 현재 문서의 최신 요청 결과만 표시한다. */
async function saveAndObserve(spec: ProjectSpec, filename: string, json: string, isCurrent: () => boolean) {
  if (!isCurrent()) return;
  const attempt: SaveAttempt = { documentId: useEditorStore.getState().documentId, spec, phase: "saving" };
  usePersistenceStatusStore.setState({ attempt });
  let phase: SaveAttempt["phase"] | null = "failed";
  try {
    const saved = await saveToWorkspace(filename, json, isCurrent);
    if (!isCurrent()) { phase = null; return; }
    if (saved) {
      // 디스크 성공은 여기서 "저장됨"으로 확정하지 않는다. diskWatch의 실제 내용 확인을 기다린다.
      useDocumentStore.getState().setFileName(filename, saved.revision);
      phase = saved.downloaded ? "downloaded" : null;
    }
  } finally {
    if (usePersistenceStatusStore.getState().attempt === attempt) {
      usePersistenceStatusStore.setState({ attempt: useEditorStore.getState().documentId === attempt.documentId && phase
        ? { ...attempt, phase } : null });
    }
  }
}

/**
 * File ▸ Save — **지금 열려 있는 그 파일**에 쓴다 (PR #145 리뷰, wook3964).
 *
 * 대상은 `documentStore.fileName`이다. 예전엔 매번 `spec.name + ".json"`을 다시
 * 계산해서, `customer-copy.json`(내부 `spec.name`은 `"Dashboard"`)을 열어 고친 뒤
 * Save하면 원본은 그대로 있고 `Dashboard.json`이 새로 생겼다 — 고친 내용이 방금
 * 연 파일이 아니라 다른 파일로 들어갔다. Save as 뒤의 Save도 같은 모양이었다.
 *
 * 아직 어느 파일도 아니면(New 직후·한 번도 저장 안 한 세션) 그때만 `spec.name`에서
 * 이름을 만든다. 저장에 성공한 뒤에는 그 이름이 곧 현재 문서가 된다 — 다음 Save는
 * 같은 파일에 쓴다.
 *
 * 돌려주는 `filename`은 **실제로 쓴 이름**이다(`buildExportPayload`가 계산한
 * `spec.name` 기반 이름이 아니라).
 */
export async function saveSpec(spec: ProjectSpec): Promise<ExportResult | null> {
  if (useSaveConflictStore.getState().paused || useSaveConflictStore.getState().check()) return null;
  const isCurrent = useSaveConflictStore.getState().captureDocument();
  const result = buildExportPayload(spec);
  if (!result.ok) {
    usePersistenceStatusStore.setState({ attempt: { documentId: useEditorStore.getState().documentId, spec, phase: "failed" } });
    window.alert(`저장할 수 없습니다 (검증 실패 ${result.issueCount}건). 콘솔을 확인하세요.`);
    return result;
  }

  const filename = useDocumentStore.getState().fileName ?? result.filename;
  await saveAndObserve(spec, filename, result.json, isCurrent);
  return { ...result, filename };
}

/**
 * File ▸ Save as — 파일명을 물어본 뒤 작업공간에 쓰고, **그 파일을 현재 문서로 삼는다.**
 * prompt를 취소하면 null을 돌려주고 아무 동작도 하지 않는다(현재 문서도 그대로다).
 *
 * prompt의 기본값도 현재 문서 이름이다 — Save as는 보통 "지금 이 파일에서 조금
 * 다른 이름으로"라서, `spec.name`이 아니라 지금 이름에서 고치기 시작하는 게 맞다.
 */
export async function saveSpecAs(spec: ProjectSpec): Promise<ExportResult | null> {
  if (useSaveConflictStore.getState().paused || useSaveConflictStore.getState().check()) return null;
  const isCurrent = useSaveConflictStore.getState().captureDocument();
  const result = buildExportPayload(spec);
  if (!result.ok) {
    usePersistenceStatusStore.setState({ attempt: { documentId: useEditorStore.getState().documentId, spec, phase: "failed" } });
    window.alert(`저장할 수 없습니다 (검증 실패 ${result.issueCount}건). 콘솔을 확인하세요.`);
    return result;
  }

  const current = useDocumentStore.getState().fileName ?? result.filename;
  const chosenName = await promptText({ title: "다른 이름으로 저장", initialValue: current, confirmLabel: "저장" });
  if (chosenName === null) {
    return null;
  }

  const filename = resolveFilename(chosenName, current);
  await saveAndObserve(spec, filename, result.json, isCurrent);
  return { ...result, filename };
}

/** A download cannot overwrite the shared workspace or change its active path. */
export function downloadConflictCopy(spec: ProjectSpec): ExportResult {
  const result = buildExportPayload(spec);
  if (result.ok) {
    downloadTextFile(`conflict-copy-${crypto.randomUUID()}.json`, result.json);
  }
  return result;
}

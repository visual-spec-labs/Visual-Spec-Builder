import type { ProjectSpec } from "@/features/editor/schema";
import {
  buildExportPayload,
  resolveFilename,
  type ExportResult,
} from "@/features/editor/store/exportSpec";
import {
  isWorkspaceAvailable,
  writeWorkspaceFile,
} from "@/features/editor/ui/workspaceClient";
import { SPEC_DIR } from "@/features/workspace/protocol";

/**
 * 브라우저 다운로드를 트리거하는 UI 레이어 래퍼(DOM 부수효과).
 * 검증(buildExportPayload)은 store에 두고 순수하게 테스트하며,
 * document/Blob/URL을 쓰는 이 파일은 DOM lib이 있는 ui/ 아래에만 둔다.
 */
function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
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
    downloadJson(result.filename, result.json);
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
 */
async function saveToWorkspace(result: ExportResult & { ok: true }): Promise<void> {
  if (!(await isWorkspaceAvailable())) {
    downloadJson(result.filename, result.json);
    return;
  }

  const relativePath = `${SPEC_DIR}/${result.filename}`;
  const written = await writeWorkspaceFile(relativePath, result.json, "application/json");

  if (!written.ok) {
    window.alert(`저장할 수 없습니다: ${written.error}`);
    return;
  }
  window.alert(`저장했습니다 — .visual-spec/${written.path}`);
}

/** File ▸ Save — 현재 파일명 그대로 작업공간에 쓴다. */
export async function saveSpec(spec: ProjectSpec): Promise<ExportResult> {
  const result = buildExportPayload(spec);
  if (!result.ok) {
    window.alert(`저장할 수 없습니다 (검증 실패 ${result.issueCount}건). 콘솔을 확인하세요.`);
    return result;
  }

  await saveToWorkspace(result);
  return result;
}

/**
 * File ▸ Save as — 파일명을 물어본 뒤 작업공간에 쓴다.
 * prompt를 취소하면 null을 돌려주고 아무 동작도 하지 않는다.
 */
export async function saveSpecAs(spec: ProjectSpec): Promise<ExportResult | null> {
  const result = buildExportPayload(spec);
  if (!result.ok) {
    window.alert(`저장할 수 없습니다 (검증 실패 ${result.issueCount}건). 콘솔을 확인하세요.`);
    return result;
  }

  const chosenName = window.prompt("파일명", result.filename);
  if (chosenName === null) {
    return null;
  }

  const filename = resolveFilename(chosenName, result.filename);
  await saveToWorkspace({ ...result, filename });
  return result;
}

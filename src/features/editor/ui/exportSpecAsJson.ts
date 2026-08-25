import type { VisualSpec } from "@/features/editor/schema";
import { buildExportPayload, type ExportResult } from "@/features/editor/store/exportSpec";

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

/** 스펙을 검증 후 JSON 파일로 내보낸다. 검증 실패 시 다운로드하지 않는다. */
export function exportSpecAsJson(spec: VisualSpec): ExportResult {
  const result = buildExportPayload(spec);
  if (result.ok) {
    downloadJson(result.filename, result.json);
  }
  return result;
}

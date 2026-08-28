import type { VisualSpec } from "@/features/editor/schema";
import {
  buildExportPayload,
  resolveFilename,
  type ExportResult,
} from "@/features/editor/store/exportSpec";

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

/**
 * 파일명을 물어본 뒤 JSON으로 내보낸다(Save as). 검증 실패 시 다운로드
 * 대신 alert로 알린다 — Open과 동일한 실패 안내 패턴(사용자 조작이
 * 원인이라 조용히 실패하면 원인을 알 수 없다). prompt를 취소하면
 * null을 돌려주고 아무 동작도 하지 않는다.
 */
export function saveSpecAsJson(spec: VisualSpec): ExportResult | null {
  const result = buildExportPayload(spec);
  if (!result.ok) {
    window.alert(`저장할 수 없습니다 (검증 실패 ${result.issueCount}건). 콘솔을 확인하세요.`);
    return result;
  }

  const chosenName = window.prompt("파일명", result.filename);
  if (chosenName === null) {
    return null;
  }

  downloadJson(resolveFilename(chosenName, result.filename), result.json);
  return result;
}

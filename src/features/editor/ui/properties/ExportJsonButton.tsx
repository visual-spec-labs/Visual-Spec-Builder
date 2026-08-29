import { useState } from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import { exportSpecAsJson } from "@/features/editor/ui/exportSpecAsJson";

/** 현재 스펙을 검증 후 JSON 파일로 내보낸다. 검증 실패 시 경고. */
export function ExportJsonButton() {
  const spec = useEditorStore((state) => state.spec);
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    const result = exportSpecAsJson(spec);
    if (!result.ok) {
      setError(`검증 실패 (${result.issueCount}건). 콘솔을 확인하세요.`);
      return;
    }
    setError(null);
  }

  return (
    <div className="border-t border-line p-3">
      {error ? <p className="mb-2 text-xs text-error">{error}</p> : null}
      <button
        type="button"
        onClick={handleExport}
        className="w-full rounded-control border border-line bg-surface py-2 text-sm font-medium text-content hover:bg-hover"
      >
        Export JSON
      </button>
    </div>
  );
}

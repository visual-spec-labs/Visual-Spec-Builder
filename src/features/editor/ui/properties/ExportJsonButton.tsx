import { useState } from "react";

import { validateVisualSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";

/** 현재 스펙을 검증 후 JSON 파일로 내보낸다. 검증 실패 시 경고. */
export function ExportJsonButton() {
  const spec = useEditorStore((state) => state.spec);
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    const result = validateVisualSpec(spec);
    if (!result.valid) {
      setError(`검증 실패 (${result.issues.length}건). 콘솔을 확인하세요.`);
      console.warn("Export 검증 실패:", result.issues);
      return;
    }

    setError(null);
    const blob = new Blob([JSON.stringify(spec, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${spec.screen.name || "screen"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
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

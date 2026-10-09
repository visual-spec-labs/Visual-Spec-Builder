import { useId, useState } from "react";

import { FieldError } from "./fields/Field";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { exportSpecAsJson } from "@/features/editor/ui/exportSpecAsJson";

/** 현재 스펙을 검증 후 JSON 파일로 내보낸다. 검증 실패 시 경고. */
export function ExportJsonButton() {
  const errorId = useId();
  const spec = useEditorStore((state) => state.spec);
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    const result = exportSpecAsJson(spec);
    if (!result.ok) {
      setError(`JSON을 내보낼 수 없습니다. 문서 검증 오류 ${result.issueCount}건을 수정한 뒤 다시 시도하세요. 자세한 내용은 콘솔에서 확인할 수 있습니다.`);
      return;
    }
    setError(null);
  }

  return (
    <div className="border-t border-line p-3">
      {error ? <div className="mb-2"><FieldError id={errorId}>{error}</FieldError></div> : null}
      <button
        type="button"
        onClick={handleExport}
        aria-describedby={error ? errorId : undefined}
        className="w-full rounded-control border border-line bg-surface py-2 text-sm font-medium text-content hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-content"
      >
        JSON 내보내기
      </button>
    </div>
  );
}

import { useMemo } from "react";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { persistenceLabels, usePersistenceStatusStore } from "@/features/editor/store/persistenceStatusStore";

export function DocumentSaveStatus() {
  const spec = useEditorStore(s => s.spec);
  const documentId = useEditorStore(s => s.documentId);
  const { fileName, diskRevision } = useDocumentStore();
  const { paused, reason } = useSaveConflictStore();
  const observations = usePersistenceStatusStore();
  const json = useMemo(() => JSON.stringify(spec), [spec]);
  const labels = persistenceLabels({ ...observations, spec, json, documentId, fileName, diskRevision, paused, reason });
  return <details className="relative text-xs text-content" onKeyDown={event => {
    if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
  }}>
    <summary className="cursor-pointer rounded-control focus-visible:outline-2 focus-visible:outline-content" aria-label={`저장 상태: ${labels.file} · ${labels.browser}`}>
      <span role="status" aria-label="저장 상태">{labels.file} · {labels.browser}</span>
    </summary>
    <div className="absolute right-0 z-50 mt-2 w-72 rounded-panel border border-line bg-surface p-3 text-left shadow-popover">
      <p>{labels.fileHelp}</p>
      <p className="mt-2">{labels.draftHelp}</p>
    </div>
  </details>;
}

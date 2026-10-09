import { useEditorStore } from "@/features/editor/store/editorStore";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { usePromptDialogStore } from "@/features/editor/store/promptDialogStore";

let pending: AbortController | undefined;

/**
 * New/Open/card share one latest-request-wins boundary, starting BEFORE async reads.
 * Every await must be followed by current(); settle is permission for an immediate
 * synchronous load only. Cancellation does not discard recovery, write disk, or resume autosave.
 */
export function beginDocumentTransition() {
  pending?.abort();
  usePromptDialogStore.getState().resolve(null);
  const controller = new AbortController();
  pending = controller;
  const isDocument = useSaveConflictStore.getState().captureDocument();
  const spec = useEditorStore.getState().spec;
  const { fileName, diskRevision } = useDocumentStore.getState();
  const current = () => pending === controller && !controller.signal.aborted && isDocument() &&
    spec === useEditorStore.getState().spec && fileName === useDocumentStore.getState().fileName &&
    diskRevision === useDocumentStore.getState().diskRevision &&
    !useSaveConflictStore.getState().paused && !useSaveConflictStore.getState().check();
  return {
    current,
    async settle(nextFileName: string | null) {
      return current() && await useSaveConflictStore.getState().settle(nextFileName, controller.signal) && current();
    },
  };
}

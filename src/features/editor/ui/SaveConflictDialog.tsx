import { useState } from "react";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { downloadConflictCopy } from "@/features/editor/ui/exportSpecAsJson";

export function SaveConflictDialog() {
  const { paused, unavailable, loadLatest } = useSaveConflictStore();
  const [message, setMessage] = useState("");
  if (!paused) return unavailable ? <div role="status" className="fixed bottom-2 left-2 bg-surface-raised p-3">
    이 브라우저에서는 탭 간 자동저장을 사용할 수 없습니다. File → Export로 별도 파일을 보관하세요.
  </div> : null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-sunken/80">
    <section role="alertdialog" aria-modal="true" aria-labelledby="save-conflict-title"
      className="max-w-lg rounded-lg bg-surface-raised p-6 text-content shadow-xl">
      <h2 id="save-conflict-title" className="mb-3 text-lg font-semibold">다른 탭에서 이 프로젝트를 변경했습니다</h2>
      <p>자동저장과 파일 덮어쓰기를 중지했습니다. 내 작업은 이 탭에 보존됩니다.</p>
      <p className="my-3 text-sm">먼저 내 작업을 별도 JSON 파일로 다운로드할 수 있습니다. 다운로드 후에도 최신 내용을 불러오기 전까지 저장은 중지됩니다.</p>
      <div className="flex flex-wrap gap-3">
        <button autoFocus className="rounded border px-3 py-2" onClick={() => {
          downloadConflictCopy(useEditorStore.getState().spec);
          setMessage("별도 파일 다운로드를 요청했습니다. 다운로드 목록에서 파일을 확인하세요.");
        }}>내 작업 별도 파일로 보관</button>
        <button className="rounded border px-3 py-2" onClick={() => {
          if (!window.confirm("내 작업 대신 다른 탭의 최신 내용을 불러올까요? 보관이 필요하면 먼저 별도 파일로 다운로드하세요.")) return;
          if (!loadLatest()) setMessage("최신 자동저장을 읽을 수 없습니다. 내 작업은 보존되며 저장 중지는 유지됩니다.");
          else setMessage("");
        }}>다른 탭의 최신 내용 불러오기</button>
        <button className="rounded border px-3 py-2" onClick={() => setMessage("취소했습니다. 내 작업과 저장 중지를 유지합니다.")}>취소 — 내 작업 유지</button>
      </div>
      <p role="status" className="mt-3 text-sm">{message}</p>
    </section>
  </div>;
}

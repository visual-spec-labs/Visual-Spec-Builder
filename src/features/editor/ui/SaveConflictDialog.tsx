import { useState } from "react";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { downloadConflictCopy } from "@/features/editor/ui/exportSpecAsJson";

export function SaveConflictDialog() {
  const { paused, reason, unavailable, loadLatest } = useSaveConflictStore();
  const [message, setMessage] = useState("");
  if (!paused) return unavailable ? <div role="status" className="fixed bottom-2 left-2 bg-surface-raised p-3">
    이 브라우저에서는 탭 간 자동저장을 사용할 수 없습니다. 파일 → JSON 내보내기로 별도 파일을 보관하세요.
  </div> : null;
  if (reason === "draft") return <DraftDialog message={message} setMessage={setMessage} />;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-sunken/80">
    <section role="alertdialog" aria-modal="true" aria-labelledby="save-conflict-title"
      className="max-w-lg rounded-lg bg-surface-raised p-6 text-content shadow-xl">
      <h2 id="save-conflict-title" className="mb-3 text-lg font-semibold">
        {reason === "disk" ? "디스크의 파일이 바뀌어 저장을 멈췄습니다" : "다른 탭에서 이 프로젝트를 변경했습니다"}
      </h2>
      <p>
        {reason === "disk"
          ? "열어 둔 뒤 다른 탭이나 도구(에이전트·git 등)가 파일을 바꿨습니다. 덮어쓰지 않도록 자동저장과 저장을 중지했습니다. 내 작업은 이 탭에 보존됩니다."
          : "자동저장과 파일 덮어쓰기를 중지했습니다. 내 작업은 이 탭에 보존됩니다."}
      </p>
      <p className="my-3 text-sm">먼저 내 작업을 별도 JSON 파일로 다운로드할 수 있습니다. 다운로드 후에도 최신 내용을 불러오기 전까지 저장은 중지됩니다.</p>
      <div className="flex flex-wrap gap-3">
        <button autoFocus className="rounded border px-3 py-2" onClick={() => {
          downloadConflictCopy(useEditorStore.getState().spec);
          setMessage("별도 파일 다운로드를 요청했습니다. 다운로드 목록에서 파일을 확인하세요.");
        }}>내 작업 별도 파일로 보관</button>
        <button className="rounded border px-3 py-2" onClick={async () => {
          if (!window.confirm(reason === "disk"
            ? "내 작업 대신 디스크의 최신 내용을 불러올까요? 보관이 필요하면 먼저 별도 파일로 다운로드하세요."
            : "내 작업 대신 다른 탭의 최신 내용을 불러올까요? 보관이 필요하면 먼저 별도 파일로 다운로드하세요.")) return;
          if (!await loadLatest()) setMessage("최신 자동저장을 읽을 수 없습니다. 내 작업은 보존되며 저장 중지는 유지됩니다.");
          else setMessage("");
        }}>{reason === "disk" ? "디스크의 최신 내용 불러오기" : "다른 탭의 최신 내용 불러오기"}</button>
        <button className="rounded border px-3 py-2" onClick={() => setMessage("취소했습니다. 내 작업과 저장 중지를 유지합니다.")}>취소 — 내 작업 유지</button>
      </div>
      <p role="status" className="mt-3 text-sm">{message}</p>
    </section>
  </div>;
}

/**
 * 연 파일보다 새 자동저장 초안이 있다(#267) — 저장 전에 다른 문서로 넘어갔거나 다른
 * 탭에서 편집만 하고 저장하지 않은 경우. "다른 탭의 변경"으로 안내하면 사용자가 방금 연
 * 디스크 내용을 "내 작업"으로 알고 초안을 버리게 된다.
 */
function DraftDialog({ message, setMessage }: { message: string; setMessage: (message: string) => void }) {
  const { loadLatest, discardDraft, readDraft } = useSaveConflictStore();
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-sunken/80">
    <section role="alertdialog" aria-modal="true" aria-labelledby="save-draft-title"
      className="max-w-lg rounded-lg bg-surface-raised p-6 text-content shadow-xl">
      <h2 id="save-draft-title" className="mb-3 text-lg font-semibold">저장하지 않은 초안이 있습니다</h2>
      <p>이 프로젝트를 편집한 뒤 파일로 저장하지 않은 자동저장 초안이 남아 있습니다. 지금 화면은 마지막으로 저장된 파일 내용입니다.</p>
      <p className="my-3 text-sm">초안을 불러오거나, 저장된 파일 내용으로 계속할 수 있습니다. 파일 내용으로 계속하면 초안은 사라지므로 필요하면 먼저 별도 파일로 내려받으세요.</p>
      <div className="flex flex-wrap gap-3">
        <button autoFocus className="rounded border px-3 py-2" onClick={async () => {
          if (!await loadLatest()) setMessage("초안을 읽을 수 없습니다. 자동저장은 중지된 상태로 유지됩니다.");
          else setMessage("");
        }}>초안 불러오기</button>
        <button className="rounded border px-3 py-2" onClick={() => {
          const draft = readDraft();
          if (!draft) { setMessage("초안을 읽을 수 없습니다."); return; }
          downloadConflictCopy(draft);
          setMessage("초안 다운로드를 요청했습니다. 다운로드 목록에서 파일을 확인하세요.");
        }}>초안 별도 파일로 내려받기</button>
        <button className="rounded border px-3 py-2" onClick={() => {
          if (!window.confirm("초안을 버리고 저장된 파일 내용으로 계속할까요? 초안은 되돌릴 수 없습니다.")) return;
          discardDraft();
          setMessage("");
        }}>저장된 파일 내용으로 계속</button>
      </div>
      <p role="status" className="mt-3 text-sm">{message}</p>
    </section>
  </div>;
}

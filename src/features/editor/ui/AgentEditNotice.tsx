import { useAgentEditStore } from "@/features/editor/store/agentEditStore";
import { useEditorStore } from "@/features/editor/store/editorStore";

/**
 * 외부 에이전트 편집(#279)의 결과를 GUI에서 확인시키는 자리. 적용됐으면 무엇이 바뀌었는지와
 * 되돌리기를, 거절됐으면 이유를, 배경을 바꾸는 편집이면 적용 여부를 묻는다.
 *
 * 되돌리기는 적용 직후 상태 그대로일 때만 보인다 — 그 뒤 사용자가 더 편집했으면 Undo 한 번이
 * 그 편집을 먼저 되돌리므로, 이 알림이 "에이전트 편집을 되돌린다"고 약속할 수 없다.
 */
export function AgentEditNotice() {
  const notice = useAgentEditStore((s) => s.notice);
  const resolveConfirm = useAgentEditStore((s) => s.resolveConfirm);
  const spec = useEditorStore((s) => s.spec);
  if (notice === null) return null;
  const close = () => useAgentEditStore.setState({ notice: null });

  return (
    <div role="status" aria-live="polite"
      className="fixed right-4 bottom-4 z-50 max-w-sm rounded-panel border border-line bg-surface-raised p-3 text-sm text-content shadow-lg">
      {notice.kind === "applied" && (
        <>
          <p className="font-semibold">외부 에이전트가 편집을 적용했습니다</p>
          <p className="mt-1 text-content-muted">{notice.message}</p>
          <div className="mt-2 flex gap-2">
            {spec === notice.spec && (
              <button type="button" className="rounded-control border border-line px-2 py-1 hover:bg-hover"
                onClick={() => { useEditorStore.getState().undo(); close(); }}>
                되돌리기
              </button>
            )}
            <button type="button" className="rounded-control px-2 py-1 hover:bg-hover" onClick={close}>닫기</button>
          </div>
        </>
      )}
      {notice.kind === "rejected" && (
        <>
          <p className="font-semibold">외부 에이전트 편집을 적용하지 않았습니다</p>
          <p className="mt-1 text-error">{notice.message}</p>
          <button type="button" className="mt-2 rounded-control px-2 py-1 hover:bg-hover" onClick={close}>닫기</button>
        </>
      )}
      {notice.kind === "confirm" && (
        <>
          <p className="font-semibold">외부 에이전트가 배경을 바꾸려 합니다</p>
          <p className="mt-1 text-content-muted">{notice.message}</p>
          <p className="mt-1 text-content-muted">대상: {notice.names.join(", ")}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="rounded-control border border-line px-2 py-1 hover:bg-hover"
              onClick={() => resolveConfirm(true)}>적용</button>
            <button type="button" className="rounded-control px-2 py-1 hover:bg-hover"
              onClick={() => resolveConfirm(false)}>적용하지 않음</button>
          </div>
        </>
      )}
    </div>
  );
}

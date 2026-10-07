import { useAgentEditStore } from "@/features/editor/store/agentEditStore";
import { useEditorStore } from "@/features/editor/store/editorStore";

/**
 * 외부 에이전트 편집과 열린 파일의 디스크 변경(#279)을 GUI에서 확인시키는 자리. 적용됐으면 무엇이 바뀌었는지와
 * 되돌리기를, 거절됐으면 이유를, 배경을 바꾸는 편집이면 적용 여부를 묻는다.
 *
 * 되돌리기는 적용 직후 상태 그대로일 때만 보인다 — 그 뒤 사용자가 더 편집했으면 Undo 한 번이
 * 그 편집을 먼저 되돌리므로, 이 알림이 "에이전트 편집을 되돌린다"고 약속할 수 없다.
 */
export function AgentEditNotice() {
  const notice = useAgentEditStore((s) => s.notice);
  const diskNotice = useAgentEditStore((s) => s.diskNotice);
  const resolveConfirm = useAgentEditStore((s) => s.resolveConfirm);
  const resolveDiskChange = useAgentEditStore((s) => s.resolveDiskChange);
  const spec = useEditorStore((s) => s.spec);
  if (notice === null && diskNotice === null) return null;
  const close = () => useAgentEditStore.setState({ notice: null });
  const closeDisk = () => useAgentEditStore.setState({ diskNotice: null });
  const panel = "rounded-panel border border-line bg-surface-raised p-3 text-sm text-content shadow-lg";

  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
      {diskNotice !== null && (
        <div role="status" aria-live="polite" className={panel}>
      {diskNotice.kind === "diskImported" && (
        <>
          <p className="font-semibold">디스크에서 바뀐 파일을 불러왔습니다</p>
          <p className="mt-1 text-content-muted">{diskNotice.fileName}이(가) 밖에서 바뀌어 지금 화면에 반영했습니다.</p>
          <div className="mt-2 flex gap-2">
            {spec === diskNotice.spec && (
              <button type="button" className="rounded-control border border-line px-2 py-1 hover:bg-hover"
                onClick={() => { useEditorStore.getState().undo(); closeDisk(); }}>
                되돌리기
              </button>
            )}
            <button type="button" className="rounded-control px-2 py-1 hover:bg-hover" onClick={closeDisk}>닫기</button>
          </div>
        </>
      )}
      {diskNotice.kind === "diskChanged" && (
        <>
          <p className="font-semibold">디스크의 파일이 바뀌었습니다</p>
          <p className="mt-1 text-content-muted">
            {diskNotice.fileName}이(가) 밖에서 바뀌었는데 이 화면에 저장하지 않은 편집이 있습니다. 불러오면 디스크
            내용으로 바뀌고 Undo로 지금 편집으로 돌아올 수 있습니다. 유지하면 다음 저장 때 충돌을 확인합니다.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="rounded-control border border-line px-2 py-1 hover:bg-hover"
              onClick={() => resolveDiskChange(true)}>디스크 내용 불러오기</button>
            <button type="button" className="rounded-control px-2 py-1 hover:bg-hover"
              onClick={() => resolveDiskChange(false)}>내 편집 유지</button>
          </div>
        </>
      )}
      {diskNotice.kind === "diskInvalid" && (
        <>
          <p className="font-semibold">디스크의 파일이 바뀌었지만 불러오지 않았습니다</p>
          <p className="mt-1 text-error">{diskNotice.fileName}의 새 내용이 검증에 실패했습니다({diskNotice.issueCount}건). 지금 화면은 그대로입니다.</p>
          <button type="button" className="mt-2 rounded-control px-2 py-1 hover:bg-hover" onClick={closeDisk}>닫기</button>
        </>
      )}
        </div>
      )}
      {notice !== null && (
    <div role="status" aria-live="polite" className={panel}>
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
      )}
    </div>
  );
}

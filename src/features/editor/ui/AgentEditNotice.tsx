import { useEffect, useState } from "react";

import { useAgentEditStore, type AgentEditNotice as Notice } from "@/features/editor/store/agentEditStore";
import { useEditorStore } from "@/features/editor/store/editorStore";

/**
 * 외부 에이전트 편집과 열린 파일의 디스크 변경(#279)을 GUI에서 확인시키는 자리. 적용됐으면 무엇이 바뀌었는지와
 * 되돌리기를, 거절됐으면 이유를, 배경을 바꾸는 편집이면 적용 여부를 묻는다.
 *
 * 되돌리기는 적용 직후 상태 그대로일 때만 보인다 — 그 뒤 사용자가 더 편집했으면 Undo 한 번이
 * 그 편집을 먼저 되돌리므로, 이 알림이 "에이전트 편집을 되돌린다"고 약속할 수 없다.
 *
 * 자리는 자연어 입력 행 바로 위다(#442) — 화면 맨 아래에 두면 그 행 오른쪽 끝 "요청" 버튼을 덮어,
 * 알림을 닫기 전에는 다음 요청을 보낼 수 없었다. 행 높이는 `NaturalLanguageBar`가
 * `--nl-bar-height`로 알린다(없으면 0). 적용 알림은 결과를 알릴 뿐이라 잠시 뒤 저절로 닫힌다 —
 * 그래도 Undo는 그대로 남는다. 마우스를 올리거나 포커스가 안에 있는 동안은 닫지 않는다(되돌리기를
 * 누르려는 중에 사라지지 않게). 거절·확인 알림은 읽고 답해야 하므로 사용자가 닫을 때까지 둔다.
 */
const APPLIED_NOTICE_TIMEOUT_MS = 8000;
const panel = "rounded-panel border border-line bg-surface-raised p-3 text-sm text-content shadow-lg";

export function AgentEditNotice() {
  const notice = useAgentEditStore((s) => s.notice);
  const diskNotice = useAgentEditStore((s) => s.diskNotice);
  const resolveDiskChange = useAgentEditStore((s) => s.resolveDiskChange);
  const spec = useEditorStore((s) => s.spec);
  if (notice === null && diskNotice === null) return null;
  const closeDisk = () => useAgentEditStore.setState({ diskNotice: null });

  return (
    <div className="fixed right-4 bottom-[calc(var(--nl-bar-height,0px)+--spacing(4))] z-50 flex max-w-sm flex-col gap-2">
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
      {notice !== null && <NoticePanel notice={notice} />}
    </div>
  );
}

/**
 * 마우스와 포커스는 따로 추적한다 — 하나로 묶으면 마우스를 떼는 순간 안에 남은 키보드 포커스까지
 * 놓친 것으로 본다. 상태를 알림 객체가 아니라 이 패널에 두므로, 포인터를 올린 채 새 알림으로
 * 바뀌어도(패널은 그대로 마운트된다) 붙잡은 상태가 이어지고, 알림이 없어져 패널이 사라지면 함께 지워진다.
 */
function NoticePanel({ notice }: { notice: Notice }) {
  const resolveConfirm = useAgentEditStore((s) => s.resolveConfirm);
  const spec = useEditorStore((s) => s.spec);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const held = hovered || focused;
  useEffect(() => {
    if (notice.kind !== "applied" || held) return;
    const timer = setTimeout(() => {
      // 그 사이 새 알림이 왔으면 그 알림은 건드리지 않는다.
      useAgentEditStore.setState((state) => (state.notice === notice ? { notice: null } : state));
    }, APPLIED_NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice, held]);
  const close = () => useAgentEditStore.setState({ notice: null });

  return (
    <div role="status" aria-live="polite" className={panel}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
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

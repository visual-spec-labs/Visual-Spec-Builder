import { useEditorStore } from "@/features/editor/store/editorStore";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { isReady } from "@/features/editor/ticket/ticketStatus";
import type { TicketStatus } from "@/features/editor/ticket/types";

const STATUS_LABEL: Record<TicketStatus, string> = {
  pending: "대기",
  "in-progress": "진행 중",
  done: "완료",
  failed: "실패",
};

/**
 * 현재 화면을 compileTickets로 나눈 구현 계획.
 *
 * #156의 A안이라 실제 에이전트를 실행하지 않는다. 사용자가 외부 에이전트로 구현하며
 * 상태를 표시할 자리와 의존 순서를 먼저 제공한다. 패널은 Properties와 같은 우측 영역을
 * 사용해 기존 Canvas/Toolbar 배치를 바꾸지 않는다.
 */
export function TicketPanel() {
  const pageId = useEditorStore((state) => state.activePageId);
  const page = useEditorStore((state) => state.spec.pages[state.activePageId]);
  const tickets = useTicketStore((state) => state.tickets);
  const sourcePageId = useTicketStore((state) => state.sourcePageId);
  const sourcePage = useTicketStore((state) => state.sourcePage);
  const compile = useTicketStore((state) => state.compile);
  const markStatus = useTicketStore((state) => state.markStatus);
  const close = useTicketStore((state) => state.close);

  const isStale = sourcePageId !== pageId || sourcePage !== page;

  return (
    <aside className="flex flex-col overflow-hidden border-l border-line bg-surface [grid-area:props]">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold tracking-wide text-content-muted uppercase">
            Implementation tickets
          </h2>
          <p className="truncate text-xs text-content-subtle">{page.name}</p>
        </div>
        <button
          type="button"
          onClick={() => compile(pageId, page)}
          className="rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-hover"
        >
          다시 생성
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="구현 티켓 닫기"
          className="rounded-control px-2 py-1 text-content-muted hover:bg-hover hover:text-content"
        >
          ×
        </button>
      </header>

      {isStale && (
        <p className="border-b border-line bg-surface-raised px-3 py-2 text-xs text-content-muted">
          화면이 바뀌었습니다. 현재 스펙으로 티켓을 다시 생성하세요.
        </p>
      )}

      <div className="flex-1 overflow-auto p-3">
        {tickets.length === 0 ? (
          <p className="text-sm text-content-subtle">생성할 구현 티켓이 없습니다.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {tickets.map((ticket) => {
              const ready = isReady(tickets, ticket);
              return (
                <li key={ticket.id} className="rounded-panel border border-line bg-surface-raised p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-content-strong">
                        {ticket.componentName}
                      </p>
                      <p className="text-xs text-content-subtle">
                        {ticket.kind === "page" ? "Page" : "Component"} · 인스턴스{" "}
                        {ticket.instances.length}개
                      </p>
                    </div>
                    {ticket.status === "pending" && (
                      <span className="rounded-control bg-surface px-1.5 py-0.5 text-xs text-content-muted">
                        {ready ? "실행 가능" : "의존 대기"}
                      </span>
                    )}
                  </div>

                  {ticket.dependsOn.length > 0 && (
                    <p className="mt-2 text-xs text-content-subtle">
                      선행: {ticket.dependsOn.join(", ")}
                    </p>
                  )}

                  <label className="mt-2 flex items-center gap-2 text-xs text-content-muted">
                    상태
                    <select
                      value={ticket.status}
                      onChange={(event) =>
                        markStatus(ticket.id, event.target.value as TicketStatus)
                      }
                      className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2 py-1 text-content"
                    >
                      {Object.entries(STATUS_LABEL).map(([status, label]) => (
                        <option key={status} value={status}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <p className="border-t border-line px-3 py-2 text-xs text-content-subtle">
        A안: 계획과 상태만 표시합니다. 실제 코드는 외부 에이전트가 생성합니다.
      </p>
    </aside>
  );
}

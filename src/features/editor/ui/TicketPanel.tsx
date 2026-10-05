import { useEffect, useState } from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { isReady, readyTickets } from "@/features/editor/ticket/ticketStatus";
import type { TicketStatus } from "@/features/editor/ticket/types";
import {
  cancelTicketRun,
  runAllTickets,
  runOneTicket,
  STALE_TICKET_MESSAGE,
} from "@/features/editor/ui/ticketRunner";
import { isWorkspaceAvailable } from "@/features/editor/ui/workspaceClient";

const STATUS_LABEL: Record<TicketStatus, string> = {
  pending: "대기",
  "in-progress": "진행 중",
  done: "완료",
  failed: "실패",
};

/**
 * 현재 화면을 compileTickets로 나눈 구현 계획.
 *
 * #156의 A안(계획·상태 표시만)에 #184가 실행 왕복을 더했다 — 작업공간이 있으면
 * "전체 실행"/항목별 "실행" 버튼이 `.visual-spec/runtime/`에 요청을 쓰고, 에이전트
 * 응답이 오면 `ui/ticketRunner.ts`의 `runAllTickets`/`runOneTicket`이 상태를 사람 손
 * 없이 바꾼다. 드롭다운은 그대로 남겨 둔다 — 에이전트가 없거나 결과를 사람이 직접
 * 고쳐야 할 때의 수동 대안이다.
 *
 * **작업공간이 없으면(정적 빌드) 조용히 A안으로 되돌아간다** — 실행 버튼을 아예
 * 숨기고 기존 드롭다운·안내문만 보여준다(`workspaceAvailable` 참고).
 *
 * 패널은 Properties와 같은 우측 영역을 사용해 기존 Canvas/Toolbar 배치를 바꾸지 않는다.
 */
export function TicketPanel() {
  const pageId = useEditorStore((state) => state.activePageId);
  const page = useEditorStore((state) => state.spec.pages[state.activePageId]);
  const tickets = useTicketStore((state) => state.tickets);
  const sourcePageId = useTicketStore((state) => state.sourcePageId);
  const sourcePage = useTicketStore((state) => state.sourcePage);
  const running = useTicketStore((state) => state.running);
  const runError = useTicketStore((state) => state.runError);
  const compile = useTicketStore((state) => state.compile);
  const markStatus = useTicketStore((state) => state.markStatus);
  const close = useTicketStore((state) => state.close);

  // `null` = 아직 확인 전. 개발 서버 미들웨어가 없는 정적 빌드에서는 `false`로
  // 떨어지고, 그때는 실행 컨트롤을 렌더링하지 않는다("조용히 A안으로 되돌아간다").
  const [workspaceAvailable, setWorkspaceAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void isWorkspaceAvailable().then((available) => {
      if (!cancelled) setWorkspaceAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isStale = sourcePageId !== pageId || sourcePage !== page;
  const canExecute = workspaceAvailable === true && !isStale;
  const readyWave = readyTickets(tickets);

  return (
    <aside className="flex flex-col overflow-hidden border-l border-line bg-surface [grid-area:props]">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold tracking-wide text-content-muted uppercase">
            Implementation tickets
          </h2>
          <p className="truncate text-xs text-content-subtle">{page.name}</p>
        </div>
        {workspaceAvailable === true && (
          <button
            type="button"
            onClick={() => (running ? cancelTicketRun() : void runAllTickets())}
            disabled={!running && (readyWave.length === 0 || isStale)}
            className="rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-hover disabled:opacity-50"
          >
            {running ? "중지" : "전체 실행"}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            // 진행 중이던 웨이브를 먼저 멈춘다 — 그러지 않아도 sourcePage 참조가
            // 바뀌어 응답이 무시되긴 하지만(ticketRunner.ts), 곧바로 멈추는 편이 낫다.
            cancelTicketRun();
            compile(pageId, page);
          }}
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
          {STALE_TICKET_MESSAGE}
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
                    {ticket.status === "pending" &&
                      (ready && canExecute ? (
                        <button
                          type="button"
                          onClick={() => void runOneTicket(ticket.id)}
                          disabled={running}
                          className="shrink-0 rounded-control border border-line px-1.5 py-0.5 text-xs text-content hover:bg-hover disabled:opacity-50"
                        >
                          실행
                        </button>
                      ) : (
                        <span className="shrink-0 rounded-control bg-surface px-1.5 py-0.5 text-xs text-content-muted">
                          {ready ? "실행 가능" : "의존 대기"}
                        </span>
                      ))}
                    {ticket.status === "in-progress" && (
                      <span className="shrink-0 rounded-control bg-surface px-1.5 py-0.5 text-xs text-content-muted">
                        실행 중…
                      </span>
                    )}
                  </div>

                  {ticket.dependsOn.length > 0 && (
                    <p className="mt-2 text-xs text-content-subtle">
                      선행: {ticket.dependsOn.join(", ")}
                    </p>
                  )}

                  {ticket.status === "failed" && ticket.error !== undefined && (
                    <p className="mt-2 text-xs text-error">{ticket.error}</p>
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

      <p role="status" aria-live="polite" className="border-t border-line px-3 py-2 text-xs">
        {workspaceAvailable === true ? (
          runError !== null && !isStale ? (
            <span className="text-error">{runError}</span>
          ) : (
            <span className="text-content-subtle">
              실행을 누르면 <code>.visual-spec/runtime/</code>에 요청을 쓰고, 에이전트가 응답을
              쓰면 상태가 자동으로 바뀝니다.
            </span>
          )
        ) : (
          <span className="text-content-subtle">
            A안: 계획과 상태만 표시합니다. 실제 코드는 외부 에이전트가 생성합니다.
          </span>
        )}
      </p>
    </aside>
  );
}

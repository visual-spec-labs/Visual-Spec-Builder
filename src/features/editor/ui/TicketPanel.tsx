import { useEffect, useState } from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import { useTicketStore } from "@/features/editor/store/ticketStore";
import { TICKET_REQUEST_PATH, TICKET_RESPONSE_PATH } from "@/features/editor/ticket/ticketProtocol";
import { isReady, readyTickets } from "@/features/editor/ticket/ticketStatus";
import type { TicketStatus } from "@/features/editor/ticket/types";
import { buildTicketAgentInstruction } from "@/features/editor/ui/agentHandoff";
import { CopyButton } from "@/features/editor/ui/CopyButton";
import { HandoffStageIndicator } from "@/features/editor/ui/HandoffStageIndicator";
import { openExportPanel } from "@/features/editor/ui/openExportPanel";
import {
  cancelTicketRun,
  runAllTickets,
  runOneTicket,
  STALE_TICKET_MESSAGE,
} from "@/features/editor/ui/ticketRunner";
import { getWorkspaceRoot, isWorkspaceAvailable } from "@/features/editor/ui/workspaceClient";

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
 * "에이전트에 전달"/항목별 "전달" 버튼이 `.visual-spec/runtime/`에 요청을 쓰고,
 * 에이전트 응답이 오면 `ui/ticketRunner.ts`의 `runAllTickets`/`runOneTicket`이
 * 상태를 사람 손 없이 바꾼다. 드롭다운은 그대로 남겨 둔다 — 에이전트가 없거나
 * 결과를 사람이 직접 고쳐야 할 때의 수동 대안이다.
 *
 * **작업공간이 없으면(정적 빌드) 조용히 A안으로 되돌아간다** — 전달 버튼을 아예
 * 숨기고 기존 드롭다운·안내문만 보여준다(`workspaceAvailable` 참고).
 *
 * **버튼 이름은 "실행"이 아니라 "전달"이다(#283).** GUI는 에이전트를 실행하지
 * 않는다(#219) — 요청 파일을 쓰고 사람이 직접 켜 둔 에이전트가 그 파일을 읽을
 * 때까지 기다릴 뿐이다. "실행"은 GUI가 뭔가를 대신 돌리는 것처럼 읽혀서 바꿨다.
 *
 * 패널은 Properties와 같은 우측 영역을 사용해 기존 Canvas/Toolbar 배치를 바꾸지 않는다.
 */
export function TicketPanel() {
  const pageId = useEditorStore((state) => state.activePageId);
  const page = useEditorStore((state) => state.spec.pages[state.activePageId]);
  const tickets = useTicketStore((state) => state.tickets);
  const sourcePageId = useTicketStore((state) => state.sourcePageId);
  const sourcePage = useTicketStore((state) => state.sourcePage);
  const documentId = useEditorStore((state) => state.documentId);
  const sourceDocumentId = useTicketStore((state) => state.sourceDocumentId);
  const running = useTicketStore((state) => state.running);
  const runError = useTicketStore((state) => state.runError);
  const compile = useTicketStore((state) => state.compile);
  const markStatus = useTicketStore((state) => state.markStatus);
  const close = useTicketStore((state) => state.close);

  // `null` = 아직 확인 전. 개발 서버 미들웨어가 없는 정적 빌드에서는 `false`로
  // 떨어지고, 그때는 전달 컨트롤을 렌더링하지 않는다("조용히 A안으로 되돌아간다").
  const [workspaceAvailable, setWorkspaceAvailable] = useState<boolean | null>(null);
  // 지시 복사 버튼 옆 "자세히"에 보여줄 절대 경로. 없어도(예: 구버전 서버) 기능은
  // 그대로 동작한다 — 표시만 빠진다.
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void isWorkspaceAvailable().then(async (available) => {
      if (cancelled) return;
      setWorkspaceAvailable(available);
      if (!available) return;
      const root = await getWorkspaceRoot();
      if (!cancelled) setWorkspaceRoot(root);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ticketRunner.isTicketPlanStale과 같은 판정이다 — 여기서는 렌더가 따라오도록 구독값으로 계산한다.
  const isStale = sourceDocumentId !== documentId || sourcePageId !== pageId || sourcePage !== page;
  const canExecute = workspaceAvailable === true && !isStale;
  const readyWave = readyTickets(tickets);
  const allDone = tickets.length > 0 && tickets.every((ticket) => ticket.status === "done");

  return (
    <aside className="flex flex-col overflow-hidden border-l border-line bg-surface [grid-area:props]">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold tracking-wide text-content-muted uppercase">
            Implementation tickets
          </h2>
          <p className="truncate text-xs text-content-muted">{page.name}</p>
        </div>
        {workspaceAvailable === true && (
          <button
            type="button"
            onClick={() => (running ? cancelTicketRun() : void runAllTickets())}
            disabled={!running && (readyWave.length === 0 || isStale)}
            className="rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-hover disabled:opacity-50"
          >
            {running ? "중지" : "에이전트에 전달"}
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

      <HandoffStageIndicator current="handoff" />

      {isStale && (
        <p className="border-b border-line bg-surface-raised px-3 py-2 text-xs text-content-muted">
          {STALE_TICKET_MESSAGE}
        </p>
      )}

      <div className="flex-1 overflow-auto p-3">
        {tickets.length === 0 ? (
          <p className="text-sm text-content-muted">
            생성할 구현 티켓이 없습니다. 캔버스에 화면을 구성한 뒤 다시 생성하세요.
          </p>
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
                      <p className="text-xs text-content-muted">
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
                          전달
                        </button>
                      ) : (
                        <span className="shrink-0 rounded-control bg-surface px-1.5 py-0.5 text-xs text-content-muted">
                          {ready ? "전달 가능" : "의존 대기"}
                        </span>
                      ))}
                    {ticket.status === "in-progress" && (
                      <span className="shrink-0 rounded-control bg-surface px-1.5 py-0.5 text-xs text-content-muted">
                        전달됨…
                      </span>
                    )}
                  </div>

                  {ticket.dependsOn.length > 0 && (
                    <p className="mt-2 text-xs text-content-muted">
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

      <div role="status" aria-live="polite" className="border-t border-line px-3 py-2 text-xs">
        {workspaceAvailable !== true ? (
          <span className="text-content-muted">
            A안: 계획과 상태만 표시합니다. 실제 코드는 외부 에이전트가 생성합니다.
          </span>
        ) : runError !== null && !isStale ? (
          <div className="flex flex-col gap-1">
            <span className="text-error">{runError}</span>
            <CopyButton text={buildTicketAgentInstruction()} label="지시 다시 복사" />
          </div>
        ) : running ? (
          <div className="flex flex-col gap-1 text-content-muted">
            <span className="flex flex-wrap items-center gap-2">
              에이전트 응답 대기 중 — 아직 전달하지 않았다면 지시를 복사해 에이전트에
              붙여 넣으세요.
              <CopyButton text={buildTicketAgentInstruction()} />
            </span>
            <TicketHandoffDetails workspaceRoot={workspaceRoot} />
          </div>
        ) : allDone ? (
          <span className="text-content-muted">
            모든 티켓이 완료됐습니다. 다음:{" "}
            <button type="button" onClick={openExportPanel} className="underline hover:text-content">
              Export에서 결과 확인
            </button>
          </span>
        ) : canExecute && readyWave.length > 0 ? (
          <div className="flex flex-col gap-1 text-content-muted">
            <span>
              웨이브 {readyWave.length}개 티켓이 전달 준비됐습니다.
              {workspaceRoot !== null && <> 작업공간: <code>{workspaceRoot}</code>.</>}
            </span>
            <CopyButton text={buildTicketAgentInstruction()} label="지시 미리 복사" />
          </div>
        ) : !isStale ? (
          <span className="text-content-muted">
            지금 전달할 수 있는 티켓이 없습니다. 의존 중인 선행 티켓이 끝나야 다음
            웨이브를 전달할 수 있습니다.
          </span>
        ) : null}
      </div>
    </aside>
  );
}

/** 요청/응답 경로와 작업공간 절대 경로 — 기본으로 접혀 있다(#283). */
function TicketHandoffDetails({ workspaceRoot }: { workspaceRoot: string | null }) {
  return (
    <details className="text-content-subtle">
      <summary className="cursor-pointer select-none">자세히</summary>
      <p className="mt-1">
        요청: <code>.visual-spec/{TICKET_REQUEST_PATH}</code> · 응답:{" "}
        <code>.visual-spec/{TICKET_RESPONSE_PATH}</code>
        {workspaceRoot !== null && (
          <>
            {" "}
            · 작업공간: <code>{workspaceRoot}</code>
          </>
        )}
      </p>
    </details>
  );
}

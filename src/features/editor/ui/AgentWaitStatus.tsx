import { useEffect, useState } from "react";

import type { AgentWaitProgress } from "@/features/editor/ui/agentRequestWait";
import { CopyButton } from "@/features/editor/ui/CopyButton";
import { HandoffDetails } from "@/features/editor/ui/HandoffDetails";

function formatRemaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * 기다리는 요청 하나의 단계·남은 시간·다음 행동(#284). `TicketPanel`·`NaturalLanguageBar`가 같은
 * 모양으로 쓴다 — 두 통로의 대기 규칙이 같으므로(`ui/agentRequestWait.ts`) 보이는 말도 같아야 한다.
 *
 * 단계 문구는 GUI가 가진 근거만 말한다(docs/26 "진행 단계"). 요청 파일을 썼다는 것과 에이전트가
 * 그걸 처리하고 있다는 것은 다른 사실이라, 출력 파일이 보이기 전에는 "실행 중"이라고 쓰지 않는다.
 */
export function AgentWaitStatus({
  progress,
  instruction,
  requestPath,
  responsePath,
  workspaceRoot = null,
  expectedOutputs,
  onExtend,
}: {
  /**
   * 대기 단계. null이면 기다림은 끝났고 호출부가 응답을 처리하는 중이다 — 티켓은 이 사이에
   * 임시 출력을 확인·확정한다(`ui/ticketOutputAcceptance.ts`).
   */
  progress: AgentWaitProgress | null;
  /** 에이전트에게 붙여 넣을 지시문. 요청 파일을 쓴 뒤에만 복사 버튼을 보인다. */
  instruction: string;
  requestPath: string;
  responsePath: string;
  workspaceRoot?: string | null;
  /** 티켓만: 이 웨이브가 기다리는 출력 파일 수. */
  expectedOutputs?: number;
  onExtend: () => void;
}) {
  const deadline = progress?.deadline ?? null;
  const [now, setNow] = useState(() => Date.now());

  // 남은 시간을 1초마다 다시 그린다. 기한이 없으면(저장 전·끝난 뒤) 돌리지 않는다.
  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const phase = progress?.phase;
  const staged = progress?.stagedFiles ?? 0;

  return (
    <div className="flex flex-col gap-1 text-content-muted">
      {progress === null && <span>응답을 받았습니다 — 결과와 출력 파일을 확인하는 중…</span>}
      {phase === "saving" && <span>요청 파일을 저장하는 중…</span>}
      {phase === "connectionLost" && (
        <span className="text-error">
          작업공간 연결이 끊겼습니다 — 개발 서버가 다시 응답하면 같은 요청을 이어서 기다립니다.
        </span>
      )}
      {phase === "waiting" && staged > 0 && (
        <span>
          에이전트가 이 요청의 임시 출력 {staged}
          {expectedOutputs !== undefined && `/${expectedOutputs}`}개를 썼습니다. 결과 응답을 기다리는 중입니다.
        </span>
      )}
      {phase === "waiting" && staged === 0 && (
        <span>
          요청을 저장했습니다 — 아직 전달하지 않았다면 지시를 복사해 에이전트에 붙여 넣으세요. GUI는
          에이전트가 실행 중인지 직접 확인하지 못합니다.
        </span>
      )}
      {deadline !== null && (
        <span className="flex flex-wrap items-center gap-2">
          <span>남은 대기 {formatRemaining(deadline - now)}</span>
          <button
            type="button"
            onClick={onExtend}
            className="rounded-control border border-line px-1.5 py-0.5 text-content hover:bg-hover"
          >
            대기 연장
          </button>
          <CopyButton text={instruction} />
        </span>
      )}
      <HandoffDetails requestPath={requestPath} responsePath={responsePath} workspaceRoot={workspaceRoot} />
    </div>
  );
}

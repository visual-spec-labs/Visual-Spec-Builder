/**
 * 수동 에이전트 요청 하나의 대기 기한·진행 단계 (이슈 #284).
 *
 * 자연어(`nl/nlAgentClient.ts`)와 티켓(`ticket/ticketAgentClient.ts`)이 같은 것을 쓴다 — 두 통로의
 * timeout·연장·연결 끊김의 뜻이 달라지지 않게 하려는 것이다. 상태 전이표는
 * docs/26-agent-request-generation-contract.md에 있다.
 *
 * DOM도 fetch도 만지지 않는다. `ui/`에 두는 이유는 이걸 쓰는 두 클라이언트가 이미
 * `ui/agentRequestLock.ts`·`ui/workspaceClient.ts`와 같은 층에서 움직여서다.
 *
 * **"모델 실행 중" 단계가 없는 이유.** GUI는 에이전트 프로세스나 로그를 보지 못한다. 확인할
 * 수 있는 것은 요청 파일을 썼는지, 작업공간 서버에 닿는지, (티켓이면) 이 요청의 임시 출력
 * 파일이 보이는지뿐이다. 단계는 그 근거만 말한다.
 */

/**
 * 처음 기다리는 시간이자 연장 한 번의 길이. 3분이다 — 사람이 창을 바꿔 에이전트에 지시를
 * 옮기는 시간이 끼는 경로라 몇 초로는 모자라고(#155), 무한정 기다리면 다음 요청을 못 한다.
 * 고정 180초만 있던 것을 "연장할 수 있는 180초"로 바꿨다.
 */
export const AGENT_WAIT_WINDOW_MS = 180_000;

/**
 * - `saving` 잠금을 잡고 요청 파일을 쓰는 중
 * - `waiting` 요청 파일을 썼다. 에이전트가 읽었는지는 모른다
 * - `connectionLost` 폴링이 작업공간 서버에 닿지 않는다. 기다림과 기한은 계속된다
 */
export type AgentWaitPhase = "saving" | "waiting" | "connectionLost";

export interface AgentWaitProgress {
  phase: AgentWaitPhase;
  /** 기한(epoch ms). 요청 파일을 쓰기 전(`saving`)에는 아직 없다. */
  deadline: number | null;
  /** 티켓만: 이 요청의 임시 출력 폴더에서 보인 파일 수. 에이전트 활동의 유일한 직접 근거다. */
  stagedFiles?: number;
}

export interface AgentRequestWait {
  /** 진행 중이면 기한을 `max(지금 기한, 지금 + 창)`으로 미루고 true. 시작 전·끝난 뒤면 false. */
  extend: () => boolean;
  /** 요청 파일을 쓴 직후 클라이언트가 부른다. 기한이 여기서 정해진다. */
  start: () => void;
  /** 기한이 지났는가. 시작 전이면 false. */
  expired: () => boolean;
  /** 클라이언트가 진행 단계를 알린다. 끝난 뒤에는 무시한다. */
  report: (phase: AgentWaitPhase, stagedFiles?: number) => void;
  /** 결과(응답·취소·timeout 등)가 정해졌다. 이후 연장·보고는 무시된다. */
  settle: () => void;
  readonly settled: boolean;
  readonly deadline: number | null;
}

/**
 * 대기 하나를 만든다. 호출부(입력창·티켓 실행기)가 만들어 클라이언트에 넘기고, "대기 연장"
 * 버튼에서 `extend`만 부른다.
 *
 * 연장이 **누적되지 않는** 이유: 중복 클릭이 기한을 두 배로 늘리면 사용자가 본 남은 시간과
 * 실제 기한이 어긋난다. "지금부터 창 하나"로 다시 맞추면 몇 번을 눌러도 한 번 누른 것과
 * 같고, 남은 시간이 창보다 길면 줄이지도 않는다.
 */
export function createAgentRequestWait(
  onProgress: (progress: AgentWaitProgress) => void = () => {},
  now: () => number = Date.now,
): AgentRequestWait {
  let deadline: number | null = null;
  let settled = false;
  let phase: AgentWaitPhase = "saving";
  let stagedFiles: number | undefined;

  function emit() {
    onProgress({ phase, deadline, ...(stagedFiles === undefined ? {} : { stagedFiles }) });
  }

  return {
    extend() {
      if (settled || deadline === null) return false;
      deadline = Math.max(deadline, now() + AGENT_WAIT_WINDOW_MS);
      emit();
      return true;
    },
    start() {
      if (settled) return;
      deadline = now() + AGENT_WAIT_WINDOW_MS;
      phase = "waiting";
      emit();
    },
    expired() {
      return deadline !== null && now() >= deadline;
    },
    report(nextPhase, nextStagedFiles) {
      if (settled) return;
      // 매 폴링 회차마다 같은 값을 다시 알리지 않는다 — 구독하는 화면이 1초마다 다시 그려진다.
      const staged = nextStagedFiles ?? stagedFiles;
      if (nextPhase === phase && staged === stagedFiles) return;
      phase = nextPhase;
      stagedFiles = staged;
      emit();
    },
    settle() {
      settled = true;
    },
    get settled() {
      return settled;
    },
    get deadline() {
      return deadline;
    },
  };
}

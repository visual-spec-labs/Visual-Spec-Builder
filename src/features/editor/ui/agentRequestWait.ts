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
  /**
   * 클라이언트가 진행 단계를 알린다. 끝난 뒤에는 무시한다. `activityEvidence`는 `stagedFiles`
   * 개수가 그대로여도 내용이 바뀐 임시 출력이 있었는지(#432) — true면 그 회차에 자동연장한다.
   */
  report: (phase: AgentWaitPhase, stagedFiles?: number, activityEvidence?: boolean) => void;
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
 *
 * **활동 증거는 자동으로 같은 연장을 준다(#432).** 사람이 화면을 지켜보며 "대기 연장"을
 * 누르지 않아도, 두 가지 증거 중 하나만 있으면 `extend()`와 같은 효과를 자동 적용한다 —
 * (1) 이 요청의 임시 출력(`stagedFiles`)이 이전에 본 적 없는 수로 늘어났다, (2) 호출부가
 * `report()`의 세 번째 자리로 "지난 회차와 내용이 달라진 임시 출력이 있다"는 `activityEvidence`를
 * 알렸다. (2)가 있는 이유는 (1)만으로는 "파일 수는 그대로인데 같은 파일을 계속 고쳐 쓰는"
 * 긴 작업(#432 리뷰)을 놓치기 때문이다 — 개수는 화면에 보이는 "N/M개" 표시와 뜻이 같아야
 * 해서 건드리지 않고, 호출부가 내용 비교까지 해서 별도로 알린다. 둘 다 에이전트가 아직 이
 * 요청을 살아서 처리하고 있다는 GUI가 가진 직접 증거다. `extend()`와 달리 기한이 이미 지난
 * 순간에도 거절하지 않는다: 폴링 루프가 매 회차 `report()` 뒤에 `expired()`를 보므로, 증거가
 * 도착한 그 회차 안에서 바로 살려야 뜻이 있다. 반대로 둘 다 없는 채(= 증거 없음) 창이 다
 * 지나면 여전히 timeout이다 — 그래야 "무한정 기다리면 다음 요청을 못 한다"는 원래
 * 안전장치가 깨지지 않는다. 첫 임시 출력이 나오기 전부터 조용히 오래 걸리는 경우는 이
 * 증거들로도 가릴 수 없는 남은 한계다(docs/26 `#432` 절).
 */
export function createAgentRequestWait(
  onProgress: (progress: AgentWaitProgress) => void = () => {},
  now: () => number = Date.now,
): AgentRequestWait {
  let deadline: number | null = null;
  let settled = false;
  let phase: AgentWaitPhase = "saving";
  let stagedFiles: number | undefined;
  /** 지금까지 본 가장 큰 staged 수. 이보다 더 늘어난 회차만 "새 증거"로 자동연장한다(#432). */
  let maxStagedFiles = 0;

  function emit() {
    onProgress({ phase, deadline, ...(stagedFiles === undefined ? {} : { stagedFiles }) });
  }

  /** `extend()`·자동연장이 공유하는 "지금부터 창 하나" 규칙. 기한이 없으면(시작 전) 아무것도 안 한다. */
  function extendDeadline(): void {
    if (deadline === null) return;
    deadline = Math.max(deadline, now() + AGENT_WAIT_WINDOW_MS);
  }

  return {
    extend() {
      if (settled || deadline === null || now() >= deadline) return false;
      extendDeadline();
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
    report(nextPhase, nextStagedFiles, activityEvidence) {
      if (settled) return;
      // 이 요청의 새 임시 출력이 보였거나(개수 증가), 개수는 그대로여도 내용이 바뀐 임시
      // 출력이 있었으면(activityEvidence, #432 리뷰) 에이전트가 살아서 처리 중이라는 직접
      // 증거다 — 사람이 "대기 연장"을 누른 것과 같은 효과를 자동으로 준다. 기한이 이미 지난
      // 순간이어도 거절하지 않는다: 이 회차의 `expired()` 판정 전에 되살려야 뜻이 있다.
      const grew = nextStagedFiles !== undefined && nextStagedFiles > maxStagedFiles;
      if (grew) maxStagedFiles = nextStagedFiles!;
      if (grew || activityEvidence === true) extendDeadline();
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

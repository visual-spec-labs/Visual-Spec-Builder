import { describe, expect, it } from "vitest";

import {
  AGENT_WAIT_WINDOW_MS,
  createAgentRequestWait,
  type AgentWaitProgress,
} from "@/features/editor/ui/agentRequestWait";

/**
 * 수동 에이전트 요청의 대기 기한·연장 규칙 (이슈 #284). 시계는 주입한 가상 시각이다 —
 * 실제 180초를 기다린 시험이 아니다.
 */
function setup() {
  let clock = 1_000_000;
  const progress: AgentWaitProgress[] = [];
  const wait = createAgentRequestWait((item) => progress.push(item), () => clock);
  return {
    wait,
    progress,
    advance: (ms: number) => { clock += ms; },
    now: () => clock,
  };
}

describe("createAgentRequestWait (#284)", () => {
  it("요청 파일을 쓰기 전에는 기한이 없고 연장도 거절한다", () => {
    const { wait } = setup();
    expect(wait.deadline).toBeNull();
    expect(wait.expired()).toBe(false);
    expect(wait.extend()).toBe(false);
  });

  it("시작하면 창 하나만큼의 기한이 생기고 waiting을 알린다", () => {
    const { wait, progress, now } = setup();
    wait.start();
    expect(wait.deadline).toBe(now() + AGENT_WAIT_WINDOW_MS);
    expect(progress.at(-1)).toEqual({ phase: "waiting", deadline: now() + AGENT_WAIT_WINDOW_MS });
  });

  it("연장은 같은 요청의 기한을 '지금부터 창 하나'로 미룬다 — 중복 클릭은 누적되지 않는다", () => {
    const { wait, advance, now } = setup();
    wait.start();
    advance(170_000);
    expect(wait.extend()).toBe(true);
    const extended = wait.deadline;
    expect(extended).toBe(now() + AGENT_WAIT_WINDOW_MS);
    // 같은 순간의 두 번째 클릭
    expect(wait.extend()).toBe(true);
    expect(wait.deadline).toBe(extended);
    // 원래 기한이 지나도 만료가 아니다
    advance(20_000);
    expect(wait.expired()).toBe(false);
    advance(AGENT_WAIT_WINDOW_MS);
    expect(wait.expired()).toBe(true);
  });

  it("남은 시간이 창보다 길 때 연장해도 기한이 줄지 않는다", () => {
    const { wait, advance } = setup();
    wait.start();
    advance(10_000);
    wait.extend();
    const longer = wait.deadline ?? 0;
    advance(-5_000); // 시계 보정 등으로 '지금'이 뒤로 가도
    wait.extend();
    expect(wait.deadline).toBe(longer);
  });

  it("결과가 정해진 요청(timeout 등)은 연장되지 않고 더 알리지 않는다", () => {
    const { wait, progress, advance } = setup();
    wait.start();
    advance(AGENT_WAIT_WINDOW_MS);
    expect(wait.expired()).toBe(true);
    wait.settle();
    const count = progress.length;
    expect(wait.extend()).toBe(false);
    wait.report("connectionLost");
    expect(progress).toHaveLength(count);
  });

  it("임시 출력 수가 이전보다 늘면 연장 클릭 없이도 자동으로 기한을 '지금부터 창 하나'로 미룬다(#432)", () => {
    const { wait, advance, now } = setup();
    wait.start();
    advance(170_000);
    wait.report("waiting", 1); // 새 증거 — 기한을 되살린다
    expect(wait.deadline).toBe(now() + AGENT_WAIT_WINDOW_MS);
    // 원래 기한(처음 시작 + 180초)을 넘겨도 아직 만료가 아니다
    advance(20_000);
    expect(wait.expired()).toBe(false);
  });

  it("같은 수를 반복 보고하면 자동연장되지 않는다 — 새 증거만 연장한다", () => {
    const { wait, advance } = setup();
    wait.start();
    advance(170_000);
    wait.report("waiting", 1);
    const extended = wait.deadline;
    advance(5_000);
    wait.report("waiting", 1); // 같은 수 — 새 증거가 아니다
    expect(wait.deadline).toBe(extended);
  });

  it("이미 기한이 지난 순간에도 새 증거가 도착하면 되살린다 — extend()보다 관대하다(#432)", () => {
    const { wait, advance, now } = setup();
    wait.start();
    advance(AGENT_WAIT_WINDOW_MS + 1); // 기한을 지났다
    expect(wait.expired()).toBe(true);
    expect(wait.extend()).toBe(false); // 수동 연장은 이미 지난 기한을 못 살린다
    wait.report("waiting", 1); // 그래도 새 임시 출력 증거는 살린다
    expect(wait.expired()).toBe(false);
    expect(wait.deadline).toBe(now() + AGENT_WAIT_WINDOW_MS);
  });

  it("임시 출력이 전혀 늘지 않으면 자동연장 없이 창이 다 지나 그대로 만료된다 — 무한 대기를 막는 안전장치는 유지된다", () => {
    const { wait, advance } = setup();
    wait.start();
    wait.report("waiting", 0);
    advance(AGENT_WAIT_WINDOW_MS);
    wait.report("waiting", 0); // 증거 없음 — 자동연장 안 함
    expect(wait.expired()).toBe(true);
  });

  it("개수는 그대로여도 activityEvidence가 true면 자동연장한다 — 같은 파일을 계속 고쳐 쓰는 경우를 놓치지 않는다(#432 리뷰 대응)", () => {
    const { wait, advance, now } = setup();
    wait.start();
    advance(170_000);
    wait.report("waiting", 1, true); // 개수는 처음 늘지만, 증거는 activityEvidence로도 줄 수 있다
    advance(170_000); // 총 340s — 개수는 그대로(1)지만 내용이 바뀐 증거만으로 또 연장한다
    wait.report("waiting", 1, true);
    expect(wait.deadline).toBe(now() + AGENT_WAIT_WINDOW_MS);
    advance(20_000);
    expect(wait.expired()).toBe(false);
  });

  it("activityEvidence로 연장될 때 phase·개수가 그대로여도 새 deadline을 알린다 — 화면 countdown이 뒤처지지 않는다(PR #451 재검토 대응)", () => {
    const { wait, advance, progress, now } = setup();
    wait.start();
    wait.report("waiting", 1); // 개수 증가로 첫 연장. phase="waiting", stagedFiles=1로 고정된다
    const emittedBeforeExtend = progress.length;
    advance(170_000);
    wait.report("waiting", 1, true); // phase·개수는 그대로지만 내용이 바뀌어 다시 연장된다
    // emit이 실제로 한 번 더 일어났고, 그 progress가 새 deadline을 담고 있어야 한다 —
    // 아니면 AgentWaitStatus가 구독한 deadline이 옛 값에 머물러 실제 요청은 살아 있는데
    // 화면만 0:00에 닿을 수 있다.
    expect(progress.length).toBe(emittedBeforeExtend + 1);
    expect(progress.at(-1)).toMatchObject({ deadline: now() + AGENT_WAIT_WINDOW_MS, stagedFiles: 1 });
  });

  it("activityEvidence가 false/미지정이면 개수가 그대로일 때 연장하지 않는다", () => {
    const { wait, advance } = setup();
    wait.start();
    wait.report("waiting", 1);
    const extended = wait.deadline;
    advance(AGENT_WAIT_WINDOW_MS - 1000);
    wait.report("waiting", 1, false); // 개수도 그대로, 내용 변화 증거도 없다
    expect(wait.deadline).toBe(extended);
  });

  it("끝난 요청(settle 후)의 staged 증가는 자동연장도 무시한다", () => {
    const { wait, advance } = setup();
    wait.start();
    advance(AGENT_WAIT_WINDOW_MS + 1000);
    wait.settle();
    const deadlineAtSettle = wait.deadline;
    wait.report("waiting", 5);
    expect(wait.deadline).toBe(deadlineAtSettle);
  });

  it("같은 단계·같은 근거는 다시 알리지 않고, 단계·임시 출력 수가 바뀔 때만 알린다", () => {
    const { wait, progress } = setup();
    wait.start();
    wait.report("waiting", 0);
    wait.report("waiting", 0);
    wait.report("connectionLost");
    wait.report("connectionLost");
    wait.report("waiting");
    wait.report("waiting", 1);
    expect(progress.map((item) => [item.phase, item.stagedFiles])).toEqual([
      ["waiting", undefined],
      ["waiting", 0],
      ["connectionLost", 0],
      ["waiting", 0],
      ["waiting", 1],
    ]);
  });
});

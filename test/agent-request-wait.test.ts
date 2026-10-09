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

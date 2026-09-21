import type { PageId, ProjectSpec, ScreenSpec } from "@/features/editor/schema";
import { validateProjectSpec, type ValidationIssue } from "@/features/editor/schema";

import { applyCommandWithReason } from "./applyCommand";
import type { Command } from "./types";

/**
 * Command 배열을 스토어에 닿기 전에 통과시키는 관문 셋 중 G2·G3
 * (docs/08-natural-language.md 4.2). G1(Command 배열의 형태 검사)은 #153의
 * `validateTransaction`이 맡는다 — 여기 들어오는 배열은 이미 Command 스키마를
 * 통과했다고 가정한다.
 *
 * GUI 경로(`editorStore.ts`의 `applied`/`appliedTransaction`)는 이 관문을 안
 * 거친다 — 패널이 경로·값 모양을 소스에 고정해 둬서 모드 A/B(4.1)가 생기지
 * 않는다. 이 파일은 **출처를 신뢰할 수 없는 Command 배열**(자연어 등) 전용이다.
 */

/** dry-run(G2)이 짚어낸 no-op Command 하나. */
export interface NoOpCommand {
  index: number;
  command: Command;
  reason: string;
}

export interface DryRunResult {
  /** 마지막 Command까지 접은 화면. no-op이 섞여 있어도 나머지는 계속 접는다. */
  screen: ScreenSpec;
  noOps: NoOpCommand[];
}

/**
 * G2 — Command를 하나씩 `applyCommandWithReason`으로 접으며 no-op을 전부
 * 기록한다. 순수 함수, 스토어를 전혀 건드리지 않는다.
 *
 * no-op이어도 그 결과(= 이전과 같은 screen 참조)를 그대로 다음 Command에 넘겨
 * 계속 접는다 — 뒤 Command는 no-op과 무관하게 성공할 수 있으므로, 한 번의
 * dry-run으로 "3번째도, 5번째도 no-op입니다"처럼 전부를 한꺼번에 짚어낸다.
 */
export function dryRunTransaction(
  screen: ScreenSpec,
  commands: readonly Command[],
): DryRunResult {
  const noOps: NoOpCommand[] = [];

  const nextScreen = commands.reduce((current, command, index) => {
    const result = applyCommandWithReason(current, command);
    if (result.reason !== undefined) {
      noOps.push({ index, command, reason: result.reason });
    }
    return result.screen;
  }, screen);

  return { screen: nextScreen, noOps };
}

/** 트랜잭션이 관문을 통과하지 못한 이유 — 어느 관문에서 걸렸는지 구분한다. */
export type TransactionFailure =
  | { kind: "pageNotFound"; pageId: PageId }
  | { kind: "noOp"; noOps: NoOpCommand[] }
  | { kind: "invalid"; issues: ValidationIssue[] };

export type TransactionGateResult =
  | { ok: true; screen: ScreenSpec }
  | { ok: false; failure: TransactionFailure };

/**
 * pageId가 유효한지 먼저 확인한 뒤 G2(dry-run) → G3(결과 검증) 순서로 관문을
 * 통과시킨다. 하나라도 걸리면 **전부-또는-전무**로 버린다 — 일부만 반영된
 * 화면을 호출부에 넘기지 않는다. dry-run이 순수 함수라 이 판정 자체가 스토어를
 * 전혀 건드리지 않으므로 전부-또는-전무가 공짜다(4.2).
 *
 * pageId 확인은 관문 번호(G2/G3)에 넣지 않았다 — docs/08 4.2가 정의한 관문이
 * 아니라, 그 이전에 필요한 전제조건이다. 이게 없으면 지워진 페이지를 가리키는
 * 낡은 pageId(예: 페이지 삭제 뒤에도 자연어 UI가 들고 있던 id)가 들어왔을 때
 * `spec.pages[pageId]`가 `undefined`라 dry-run 내부에서 그대로 예외로 터진다 —
 * 신뢰 못 할 입력을 `{ ok:false, failure }`로 걸러낸다는 이 파일의 목적과
 * 어긋난다.
 */
export function runTransactionGates(
  spec: ProjectSpec,
  pageId: PageId,
  commands: readonly Command[],
): TransactionGateResult {
  const screen = spec.pages[pageId];
  if (screen === undefined) {
    return { ok: false, failure: { kind: "pageNotFound", pageId } };
  }

  const { screen: nextScreen, noOps } = dryRunTransaction(screen, commands);

  if (noOps.length > 0) {
    return { ok: false, failure: { kind: "noOp", noOps } };
  }

  // G3 — 결과 페이지를 끼운 프로젝트 전체가 여전히 유효한가(4.1 모드 B).
  // 한 Command 안의 경로 방어(#146)로는 못 잡는, 여러 Command에 걸친 조합이
  // 여기서 잡힌다. withPage(editorStore.ts)와 같은 일이지만 store 의존성을
  // 새로 만들지 않으려고 한 줄을 그대로 여기 쓴다.
  const trialSpec: ProjectSpec = { ...spec, pages: { ...spec.pages, [pageId]: nextScreen } };
  const result = validateProjectSpec(trialSpec);
  if (!result.valid) {
    return { ok: false, failure: { kind: "invalid", issues: result.issues } };
  }

  return { ok: true, screen: nextScreen };
}

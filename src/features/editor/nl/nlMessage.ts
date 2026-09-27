/**
 * 자연어 경로가 입력창 옆 **한 자리**에 내는 문장을 만드는 순수 함수 (이슈 #155).
 *
 * docs/08-natural-language.md 4.3이 자리를 못박았다 — *"알림은 자연어 입력창에 붙은
 * 인라인 한 자리로만 낸다. `window.alert`도 `console.warn`도 쓰지 않는다."*
 * 성공도 같은 자리에 한 줄이고(*"노드 3개를 추가했습니다. [되돌리기]"*), 실패도
 * 같은 자리다. 그래서 성공/실패 문구를 만드는 코드가 여기 한 파일에 모여 있다.
 *
 * 문장 조립을 UI에서 떼어낸 이유는 `nlScope.ts`와 같다 — 이 저장소의 vitest
 * environment가 `node`라 브라우저 API에 얽히면 테스트가 안 된다.
 */

import type { CommandValidationIssue } from "@/features/editor/command/validate";
import type { TransactionFailure } from "@/features/editor/command/transactionGate";
import type { Command } from "@/features/editor/command/types";

/**
 * 성공 문장. Command 종류별로 **건드린 대상 수**를 센다.
 *
 * Command 개수가 아니라 대상 수인 이유: 한 노드의 `layout.gap`과 `layout.padding`을
 * 각각 바꾸면 `updateNode`가 둘이지만 사용자가 본 것은 노드 하나가 바뀐 화면이다.
 * `updateScreen`은 노드를 가리키지 않아(docs/08 3.4-(3)) Command 수를 그대로 센다.
 *
 * 표시 순서는 고정이다(생성 → 수정 → 레이아웃 → 이동 → 삭제 → 화면). Command 배열이
 * 온 순서대로 적으면 같은 편집이 매번 다른 문장이 된다.
 */
export function describeCommands(commands: readonly Command[]): string {
  const created = new Set<string>();
  const updated = new Set<string>();
  const laidOut = new Set<string>();
  const moved = new Set<string>();
  const deleted = new Set<string>();
  let screenChanges = 0;

  for (const command of commands) {
    switch (command.type) {
      case "createNode":
        created.add(command.id);
        break;
      case "updateNode":
        updated.add(command.id);
        break;
      case "setLayout":
        laidOut.add(command.id);
        break;
      case "moveNode":
        moved.add(command.id);
        break;
      case "deleteNode":
        deleted.add(command.id);
        break;
      case "updateScreen":
        screenChanges += 1;
        break;
    }
  }

  const parts: string[] = [];
  if (created.size > 0) parts.push(`노드 ${created.size}개를 추가했습니다`);
  if (updated.size > 0) parts.push(`노드 ${updated.size}개를 수정했습니다`);
  if (laidOut.size > 0) parts.push(`레이아웃 ${laidOut.size}개를 바꿨습니다`);
  if (moved.size > 0) parts.push(`노드 ${moved.size}개를 옮겼습니다`);
  if (deleted.size > 0) parts.push(`노드 ${deleted.size}개를 삭제했습니다`);
  if (screenChanges > 0) parts.push(`화면 설정 ${screenChanges}개를 바꿨습니다`);

  if (parts.length === 0) return "변경 사항이 없습니다.";
  return `${parts.join(", ")}.`;
}

/** 이유 목록이 길어도 한 줄에 다 붓지 않는다 — 앞 셋만 보이고 나머지는 수로 접는다. */
const MAX_REASONS = 3;

function foldReasons(reasons: string[]): string {
  if (reasons.length <= MAX_REASONS) return reasons.join(" / ");
  const shown = reasons.slice(0, MAX_REASONS).join(" / ");
  return `${shown} 외 ${reasons.length - MAX_REASONS}건`;
}

/**
 * G1(Command 스키마) 실패 문장.
 *
 * `path`는 Ajv가 준 instancePath(`/commands/0/id` 등)다 — 어느 Command가 문제인지
 * 사용자가 에이전트에게 그대로 되물을 수 있는 유일한 단서라 지우지 않는다.
 */
export function describeCommandIssues(issues: readonly CommandValidationIssue[]): string {
  const reasons = issues.map((issue) => `${issue.path} ${issue.message}`);
  return `Command 형식이 올바르지 않아 적용하지 않았습니다. ${foldReasons(reasons)}`;
}

/**
 * G2·G3(dry-run·결과 검증) 실패 문장.
 *
 * 셋 다 **적용하지 않았다**는 말로 시작한다 — 전부-또는-전무라는 사실이 사용자에게
 * 가장 먼저 닿아야 한다(docs/08 4.2). "왜"는 그다음이다.
 */
export function describeTransactionFailure(failure: TransactionFailure): string {
  switch (failure.kind) {
    case "pageNotFound":
      return `적용하지 않았습니다. 대상 페이지를 찾을 수 없습니다(${failure.pageId}).`;
    case "noOp": {
      // index는 0부터라 사람이 세는 번호로 바꾼다 — docs/08 4.2가 든 예가
      // "3번째 명령이 아무 일도 하지 않았습니다"다.
      const reasons = failure.noOps.map(
        (noOp) => `${noOp.index + 1}번째(${noOp.command.type}) ${noOp.reason}`,
      );
      return `적용하지 않았습니다. 아무 일도 하지 않는 명령이 있습니다 — ${foldReasons(reasons)}`;
    }
    case "invalid": {
      const reasons = failure.issues.map((issue) => `${issue.path} ${issue.message}`);
      return `적용하지 않았습니다. 결과 스펙이 검증을 통과하지 못했습니다 — ${foldReasons(reasons)}`;
    }
  }
}

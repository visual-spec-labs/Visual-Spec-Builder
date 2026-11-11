import { describe, expect, it } from "vitest";

import {
  describeCommandIssues,
  describeCommands,
  describeTransactionFailure,
} from "@/features/editor/nl/nlMessage";
import type { Command } from "@/features/editor/command/types";

/**
 * 입력창 옆 한 자리에 나갈 문장 (이슈 #155, docs/08 4.3).
 *
 * 성공/실패 문구가 UI에 흩어지면 `window.alert`·`console.warn`이 다시 스며든다 —
 * 07 5.3이 문제로 적은 그 상태다. 문장을 순수 함수로 두고 여기서 고정한다.
 */

const update = (id: string, path: string): Command => ({
  type: "updateNode",
  id,
  path,
  value: 1,
});

describe("describeCommands — 성공 한 줄", () => {
  it("추가한 노드 수를 센다 — docs/08 4.3의 예문", () => {
    const commands: Command[] = ["a", "b", "c"].map((id) => ({
      type: "createNode",
      parentId: "root",
      id,
      node: {
        type: "text",
        name: id,
        box: { width: "fill", height: "auto" },
        content: id,
        color: "#111111",
        typography: {
          fontFamily: "Pretendard",
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 20,
          letterSpacing: 0,
          textAlign: "left",
        },
      },
    }));

    expect(describeCommands(commands)).toBe("노드 3개를 추가했습니다.");
  });

  it("같은 노드를 여러 번 고쳐도 노드 하나로 센다 — 사용자가 본 것이 그렇다", () => {
    expect(describeCommands([update("card", "layout.gap"), update("card", "box.width")])).toBe(
      "노드 1개를 수정했습니다.",
    );
  });

  it("종류가 섞이면 고정된 순서로 잇는다", () => {
    const commands: Command[] = [
      { type: "updateScreen", path: "name", value: "Login" },
      { type: "deleteNode", id: "old" },
      update("card", "layout.gap"),
    ];

    expect(describeCommands(commands)).toBe(
      "노드 1개를 수정했습니다, 노드 1개를 삭제했습니다, 화면 설정 1개를 바꿨습니다.",
    );
  });

  it("setLayout 은 레이아웃으로 따로 센다", () => {
    const command: Command = {
      type: "setLayout",
      id: "root",
      layout: {
        direction: "column",
        gap: 24,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        mainAxis: "start",
        crossAxis: "stretch",
      },
    };

    expect(describeCommands([command])).toBe("레이아웃 1개를 바꿨습니다.");
  });

  it("빈 배열이면 변경 없음이다 — 관문이 먼저 막지만 문장은 남는다", () => {
    expect(describeCommands([])).toBe("변경 사항이 없습니다.");
  });
});

describe("describeCommandIssues — G1 실패", () => {
  it("적용하지 않았다는 말과 Ajv 경로를 함께 낸다", () => {
    const message = describeCommandIssues([
      { code: "schema", path: "/commands/0/id", message: '필수 필드 "id"가 없습니다.' },
    ]);

    expect(message).toContain("적용하지 않았습니다");
    expect(message).toContain("/commands/0/id");
  });

  it("이유가 넷 이상이면 셋만 보이고 나머지는 수로 접는다", () => {
    const issues = Array.from({ length: 5 }, (_, index) => ({
      code: "schema" as const,
      path: `/commands/${index}`,
      message: "틀렸습니다.",
    }));

    expect(describeCommandIssues(issues)).toContain("외 2건");
  });
});

describe("describeTransactionFailure — G2·G3 실패", () => {
  it("no-op 은 사람이 세는 번호로 말한다 — 0번째가 아니라 1번째다", () => {
    const message = describeTransactionFailure({
      kind: "noOp",
      noOps: [
        {
          index: 2,
          command: { type: "deleteNode", id: "root" },
          reason: "root는 삭제할 수 없습니다.",
        },
      ],
    });

    expect(message).toContain("3번째");
    expect(message).toContain("root는 삭제할 수 없습니다.");
    expect(message).toContain("적용하지 않았습니다");
  });

  it("G3 실패는 검증 이슈를 그대로 근거로 쓴다", () => {
    const message = describeTransactionFailure({
      kind: "invalid",
      issues: [{ code: "child-missing", path: "/nodes/root/children/0", message: "없는 자식" }],
    });

    expect(message).toContain("결과 스펙이 검증을 통과하지 못했습니다");
    expect(message).toContain("/nodes/root/children/0");
  });

  it("없는 페이지를 가리키면 그 사실을 말한다", () => {
    expect(describeTransactionFailure({ kind: "pageNotFound", pageId: "지워진페이지" })).toContain(
      "지워진페이지",
    );
  });
});

import { describe, expect, it } from "vitest";

import type { Node } from "@/features/editor/schema";
import {
  buildParentMap,
  clickBoundary,
  isWithin,
  resolveClickTarget,
  resolveEnterTarget,
  resolveExitTarget,
  resolveInsertParent,
  siblingId,
} from "@/features/editor/ui/selection";

function frame(name: string, children: string[]): Node {
  return {
    type: "frame",
    name,
    box: { width: "fill", height: "auto" },
    layout: {
      direction: "column",
      gap: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      mainAxis: "start",
      crossAxis: "start",
    },
    children: children.map((node) => ({ node })),
  };
}

function text(name: string): Node {
  return {
    type: "text",
    name,
    box: { width: "auto", height: "auto" },
    content: name,
    color: "#111111",
    typography: {
      fontFamily: "Pretendard",
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 24,
      letterSpacing: 0,
      textAlign: "left",
    },
  };
}

/** root > content > cardA > cardALabel — 3단계 중첩. */
const nodes: Record<string, Node> = {
  root: frame("Root", ["header", "content"]),
  header: frame("Header", ["headerTitle"]),
  headerTitle: text("Title"),
  content: frame("Content", ["cardA"]),
  cardA: frame("Card", ["cardALabel"]),
  cardALabel: text("Label"),
};

const root = "root";

describe("buildParentMap", () => {
  it("자식에서 부모를 거슬러 올라갈 수 있게 역맵을 만든다", () => {
    const parents = buildParentMap(nodes);

    expect(parents.get("cardALabel")).toBe("cardA");
    expect(parents.get("cardA")).toBe("content");
    expect(parents.get("content")).toBe("root");
    expect(parents.get("root")).toBeUndefined();
  });
});

describe("resolveClickTarget — 일반 클릭(최상위)", () => {
  it("3단계 안쪽을 클릭해도 root 바로 아래 조상을 선택한다", () => {
    expect(
      resolveClickTarget({ nodes, root, clickedId: "cardALabel", deep: false }),
    ).toBe("content");
  });

  it("이미 최상위인 노드를 클릭하면 그대로 둔다", () => {
    expect(
      resolveClickTarget({ nodes, root, clickedId: "header", deep: false }),
    ).toBe("header");
  });

  it("root 자신을 클릭하면 root를 선택한다", () => {
    expect(resolveClickTarget({ nodes, root, clickedId: root, deep: false })).toBe(
      root,
    );
  });
});

describe("resolveClickTarget — Cmd/Ctrl+클릭(상세 지정)", () => {
  it("실제로 클릭한 최하위 노드를 그대로 선택한다", () => {
    expect(
      resolveClickTarget({ nodes, root, clickedId: "cardALabel", deep: true }),
    ).toBe("cardALabel");
  });

  it("중간 깊이의 노드도 클릭한 그대로 잡힌다", () => {
    expect(
      resolveClickTarget({ nodes, root, clickedId: "cardA", deep: true }),
    ).toBe("cardA");
  });
});

describe("resolveClickTarget — 망가진 스펙 방어", () => {
  it("존재하지 않는 id면 root로 떨어진다", () => {
    expect(
      resolveClickTarget({ nodes, root, clickedId: "없는노드", deep: false }),
    ).toBe(root);
  });

  it("부모가 없는 고아 노드는 자기 자신이 최상위다", () => {
    const orphaned = { ...nodes, floating: text("Floating") };

    expect(
      resolveClickTarget({
        nodes: orphaned,
        root,
        clickedId: "floating",
        deep: false,
      }),
    ).toBe("floating");
  });

  it("부모-자식이 순환해도 멈춘다", () => {
    // a > b > a. 검증기가 cycle로 잡는 스펙이지만 UI가 멈춰서는 안 된다.
    const cyclic: Record<string, Node> = {
      root: frame("Root", ["a"]),
      a: frame("A", ["b"]),
      b: frame("B", ["a"]),
    };

    expect(
      resolveClickTarget({ nodes: cyclic, root, clickedId: "b", deep: false }),
    ).toBe("a");
  });
});

describe("resolveClickTarget — 진입 문맥(focusRootId) 경계(#151)", () => {
  // 더블클릭으로 프레임에 "들어가면" root 대신 그 프레임을 경계로 넘긴다 —
  // 함수는 새 개념을 모르고, 호출부가 넘기는 root 인자의 뜻만 넓어진다.
  it("경계를 content로 좁히면 그 자식이 최상위가 된다", () => {
    expect(
      resolveClickTarget({ nodes, root: "content", clickedId: "cardALabel", deep: false }),
    ).toBe("cardA"); // root 경계였으면 "content"가 나왔을 것(위 테스트 참고)
  });

  it("경계 자신을 클릭하면 그대로 경계가 선택된다", () => {
    expect(
      resolveClickTarget({ nodes, root: "content", clickedId: "content", deep: false }),
    ).toBe("content");
  });

  it("경계 바깥(형제 서브트리)을 클릭하면 진짜 root까지 올라간다", () => {
    // content로 들어가 있어도 header 쪽을 클릭하면 그 경계("content")를 못
    // 만나 끝까지 오른다 — 부모 체인이 "content"를 지나지 않기 때문이다.
    // resolveClickTarget 자신은 이걸 모르고 그냥 끝까지 오른다("root"가 된다).
    // 호출부가 이 경우를 어떻게 다루는지는 clickBoundary가 대신 판단한다.
    expect(
      resolveClickTarget({ nodes, root: "content", clickedId: "headerTitle", deep: false }),
    ).toBe("root");
  });
});

describe("clickBoundary — 실제 클릭이 쓸 경계(#151)", () => {
  it("문맥이 없으면(focusRootId null) 진짜 root를 그대로 쓴다", () => {
    expect(clickBoundary(nodes, root, null, "cardALabel")).toBe(root);
  });

  it("클릭이 문맥 서브트리 안이면 문맥을 경계로 쓴다", () => {
    expect(clickBoundary(nodes, root, "content", "cardALabel")).toBe("content");
  });

  it("문맥 자신을 클릭해도 문맥을 그대로 쓴다", () => {
    expect(clickBoundary(nodes, root, "content", "content")).toBe("content");
  });

  it("클릭이 문맥 서브트리 밖(다른 가지)이면 진짜 root로 물러난다", () => {
    // "다른 가지를 클릭"은 이슈가 정한 문맥 이탈 트리거(Esc·바깥 클릭·페이지
    // 전환)가 아니다 — 문맥을 벗어나는 게 아니라 문맥이 원래 못 미치는 곳이라
    // 문맥이 없을 때와 같은 결과로 돌려보낸다.
    expect(clickBoundary(nodes, root, "content", "headerTitle")).toBe(root);
    expect(clickBoundary(nodes, root, "content", "header")).toBe(root);
  });

  it("문맥이 클릭 대상의 자손이면(있을 수 없는 모양이지만) 진짜 root로 물러난다", () => {
    expect(clickBoundary(nodes, root, "cardALabel", "content")).toBe(root);
  });
});

describe("resolveInsertParent", () => {
  it("프레임을 클릭하면 그 프레임 안에 넣는다", () => {
    expect(resolveInsertParent({ nodes, root, clickedId: "cardA" })).toBe("cardA");
  });

  it("텍스트를 클릭하면 가장 가까운 조상 프레임에 넣는다", () => {
    // 텍스트 노드는 children이 없어 부모가 될 수 없다.
    expect(resolveInsertParent({ nodes, root, clickedId: "cardALabel" })).toBe(
      "cardA",
    );
  });

  it("대상을 찾을 수 없으면 root에 넣는다", () => {
    expect(resolveInsertParent({ nodes, root, clickedId: "없는노드" })).toBe(root);
  });
});

describe("siblingId — Tab/Shift+Tab 형제 이동(#151)", () => {
  // root의 자식은 [header, content] 둘이라 순환을 볼 수 있다.
  it("다음 형제로 옮긴다", () => {
    expect(siblingId(nodes, "header", "next")).toBe("content");
  });

  it("이전 형제로 옮긴다", () => {
    expect(siblingId(nodes, "content", "prev")).toBe("header");
  });

  it("끝에서는 반대쪽 끝으로 순환한다", () => {
    expect(siblingId(nodes, "content", "next")).toBe("header"); // 마지막 → 처음
    expect(siblingId(nodes, "header", "prev")).toBe("content"); // 처음 → 마지막
  });

  it("형제가 자기 하나뿐이면 자기 자신이다", () => {
    // cardA의 자식은 cardALabel 하나뿐이다.
    expect(siblingId(nodes, "cardALabel", "next")).toBe("cardALabel");
    expect(siblingId(nodes, "cardALabel", "prev")).toBe("cardALabel");
  });

  it("root는 부모가 없어 형제가 없다", () => {
    expect(siblingId(nodes, root, "next")).toBeNull();
  });

  it("고아 노드는 부모가 없어 형제가 없다", () => {
    const orphaned = { ...nodes, floating: text("Floating") };
    expect(siblingId(orphaned, "floating", "next")).toBeNull();
  });

  it("진입 문맥과 무관하다 — focusRootId를 받지 않는다", () => {
    // header 안에 들어가 있어도(headerTitle 선택) 형제는 여전히 실제 트리
    // 기준이다 — 여기엔 그 개념 자체가 없다(함수 시그니처에 경계 인자가 없다).
    expect(siblingId(nodes, "headerTitle", "next")).toBe("headerTitle");
  });
});

describe("resolveClickTarget — 컨테이너 안에 들어간 뒤 (#151)", () => {
  it("들어간 컨테이너 바로 아래가 클릭 단위가 된다", () => {
    // content 에 들어가 있으면 그 안의 cardA 가 잡힌다 — 예전엔 언제나 content 였다.
    expect(
      resolveClickTarget({
        nodes,
        root,
        clickedId: "cardALabel",
        deep: false,
        container: "content",
      }),
    ).toBe("cardA");
  });

  it("한 겹 더 들어가면 그만큼 더 안쪽이 잡힌다", () => {
    expect(
      resolveClickTarget({
        nodes,
        root,
        clickedId: "cardALabel",
        deep: false,
        container: "cardA",
      }),
    ).toBe("cardALabel");
  });

  it("컨테이너 자신을 클릭하면 자신이 잡힌다", () => {
    expect(
      resolveClickTarget({
        nodes,
        root,
        clickedId: "cardA",
        deep: false,
        container: "cardA",
      }),
    ).toBe("cardA");
  });

  it("컨테이너를 안 주면 예전과 똑같다 — 기존 호출부가 안 깨진다", () => {
    expect(
      resolveClickTarget({ nodes, root, clickedId: "cardALabel", deep: false }),
    ).toBe("content");
  });

  it("스펙에 없는 컨테이너는 무시하고 root 기준으로 돌아간다", () => {
    // 들어가 있던 노드를 지우면 이 상태가 된다. 그 안에 갇혀 아무것도 못 고르면 안 된다.
    expect(
      resolveClickTarget({
        nodes,
        root,
        clickedId: "cardALabel",
        deep: false,
        container: "지워진노드",
      }),
    ).toBe("content");
  });

  it("Ctrl+클릭은 컨테이너와 무관하게 최하위다", () => {
    expect(
      resolveClickTarget({
        nodes,
        root,
        clickedId: "cardALabel",
        deep: true,
        container: "content",
      }),
    ).toBe("cardALabel");
  });
});

describe("isWithin — 바깥을 클릭했는지", () => {
  it("자손이면 참이다", () => {
    expect(isWithin(nodes, "content", "cardALabel")).toBe(true);
    expect(isWithin(nodes, "root", "cardALabel")).toBe(true);
  });

  it("자기 자신도 참이다", () => {
    expect(isWithin(nodes, "cardA", "cardA")).toBe(true);
  });

  it("다른 가지면 거짓이다 — 이때 한 겹 빠져나온다", () => {
    expect(isWithin(nodes, "content", "headerTitle")).toBe(false);
  });

  it("조상은 자손 안에 있지 않다", () => {
    expect(isWithin(nodes, "cardA", "content")).toBe(false);
  });
});

describe("resolveEnterTarget — 더블클릭으로 한 겹 들어가기", () => {
  it("한 번에 한 겹만 내려간다 — 깊은 글자를 눌러도 중간을 건너뛰지 않는다", () => {
    expect(resolveEnterTarget({ nodes, root, clickedId: "cardALabel" })).toBe("content");
  });

  it("들어간 상태에서 다시 하면 그다음 겹이다", () => {
    expect(
      resolveEnterTarget({ nodes, root, clickedId: "cardALabel", container: "content" }),
    ).toBe("cardA");
  });

  it("텍스트에는 들어가지 않는다 — 안에 고를 자식이 없다", () => {
    expect(
      resolveEnterTarget({ nodes, root, clickedId: "cardALabel", container: "cardA" }),
    ).toBeNull();
  });

  it("컨테이너 자신을 더블클릭하면 더 들어갈 곳이 없다", () => {
    expect(
      resolveEnterTarget({ nodes, root, clickedId: "cardA", container: "cardA" }),
    ).toBeNull();
  });

  it("스펙에 없는 노드면 null 이다", () => {
    expect(resolveEnterTarget({ nodes, root, clickedId: "없는노드" })).toBeNull();
  });
});

describe("resolveExitTarget — 한 겹 빠져나오기", () => {
  it("부모 컨테이너로 올라간다", () => {
    expect(resolveExitTarget(nodes, "cardA")).toBe("content");
  });

  it("root 바로 아래에서 나오면 null — 아무 데도 안 들어간 상태다", () => {
    expect(resolveExitTarget(nodes, "content")).toBe("root");
    expect(resolveExitTarget(nodes, "root")).toBeNull();
  });
});

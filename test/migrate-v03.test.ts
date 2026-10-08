import { describe, expect, it } from "vitest";

import {
  migrateToV03,
  validateProjectSpec,
  validateVisualSpec,
} from "@/features/editor/schema";
import type { Node, ProjectSpec, ScreenSpec, VisualSpec } from "@/features/editor/schema";
import { buttonStyle, frameStyle, inputStyle } from "@/features/editor/ui/nodeStyles";
import {
  previewButtonStyle,
  previewFrameStyle,
  previewInputStyle,
} from "@/features/editor/ui/homePreview";

import cardEffectsExample from "../examples/card-effects.json";
import dashboardCardsExample from "../examples/dashboard-cards.json";
import twoPageExample from "../examples/two-page-project.json";
import legacyCardEffects from "./fixtures/legacy/card-effects.v0.1.json";
import legacyDashboard from "./fixtures/legacy/dashboard-cards.v0.1.json";
import legacyTwoPage from "./fixtures/legacy/two-page-project.v0.2.json";

/**
 * 0.1·0.2 → 0.3 변환(#127). 픽스처는 전환 직전 develop의 예제 파일을 그대로 떠 둔
 * 것이다(test/fixtures/legacy) — 손으로 만든 옛 모양이 아니라 실제로 저장돼 있던
 * 문서라야 "기존 문서는 그대로 열린다"를 보증한다.
 */

type LegacyNode = { background?: { color: string } } & Record<string, unknown>;

function legacyScreens(): { name: string; screen: { nodes: Record<string, LegacyNode> } }[] {
  return [
    { name: "dashboard-cards(0.1)", screen: legacyDashboard.screen },
    { name: "card-effects(0.1)", screen: legacyCardEffects.screen },
    ...Object.entries(legacyTwoPage.pages).map(([pageId, page]) => ({
      name: `two-page-project(0.2)/${pageId}`,
      screen: page,
    })),
  ] as { name: string; screen: { nodes: Record<string, LegacyNode> } }[];
}

describe("migrateToV03 — 옛 문서", () => {
  it("옛 문서는 새 검증기를 그대로는 통과하지 못한다 — 입구의 변환이 필요한 이유", () => {
    expect(validateVisualSpec(legacyDashboard).valid).toBe(false);
    expect(validateProjectSpec(legacyTwoPage).valid).toBe(false);
  });

  it("0.1 화면 문서를 변환하면 0.3으로 유효하다", () => {
    const migrated = migrateToV03(legacyDashboard);

    expect(validateVisualSpec(migrated)).toEqual({ valid: true, issues: [] });
    expect((migrated as VisualSpec).version).toBe("0.3");
  });

  it("0.2 프로젝트 문서를 변환하면 0.3으로 유효하다", () => {
    const migrated = migrateToV03(legacyTwoPage);

    expect(validateProjectSpec(migrated)).toEqual({ valid: true, issues: [] });
    expect((migrated as ProjectSpec).version).toBe("0.3");
  });

  it("{ color }를 solid 한 겹 배열로 바꾸고 나머지는 그대로 둔다", () => {
    const migrated = migrateToV03(legacyDashboard) as VisualSpec;

    expect(migrated.screen.nodes.root).toEqual({
      ...legacyDashboard.screen.nodes.root,
      background: [{ type: "solid", color: "#F7F8FA" }],
    });
    // 배경이 없던 노드는 건드리지 않는다(같은 참조).
    expect(migrated.screen.nodes.header).toBe(legacyDashboard.screen.nodes.header);
  });

  it("입력을 고치지 않는다", () => {
    const before = structuredClone(legacyTwoPage);
    migrateToV03(legacyTwoPage);

    expect(legacyTwoPage).toEqual(before);
  });

  it("examples/의 0.3 예제는 옛 예제를 이 함수로 변환한 결과와 같다", () => {
    expect(migrateToV03(legacyDashboard)).toEqual(dashboardCardsExample);
    expect(migrateToV03(legacyCardEffects)).toEqual(cardEffectsExample);
    expect(migrateToV03(legacyTwoPage)).toEqual(twoPageExample);
  });

  it("이미 0.3인 문서는 그대로 돌려준다", () => {
    expect(migrateToV03(dashboardCardsExample)).toBe(dashboardCardsExample);
    expect(migrateToV03(twoPageExample)).toBe(twoPageExample);
  });
});

describe("migrateToV03 — 아는 모양이 아니면 건드리지 않는다", () => {
  /** 0.1 화면 문서에 노드 하나를 얹는다. 변환 뒤 그 노드의 background만 본다. */
  function migratedBackground(background: unknown): unknown {
    const doc = {
      version: "0.1",
      screen: { name: "S", size: { width: 1, height: 1 }, root: "n", nodes: { n: { background } } },
    };
    const migrated = migrateToV03(doc) as { screen: { nodes: { n: { background: unknown } } } };
    return migrated.screen.nodes.n.background;
  }

  it.each([
    ["색이 문자열이 아님", { color: 123 }],
    ["다른 칸이 섞임", { color: "#FFFFFF", image: "a.png" }],
    ["color가 없음", {}],
    ["이미 배열", [{ type: "solid", color: "#FFFFFF" }]],
    ["null", null],
    ["문자열", "#FFFFFF"],
  ])("background가 %s이면 그대로 둔다", (_name, background) => {
    expect(migratedBackground(background)).toBe(background);
  });

  it("0.3 문서에 남은 { color }는 고쳐 주지 않는다 — 검증이 보고한다", () => {
    const doc = structuredClone(dashboardCardsExample) as unknown as {
      screen: { nodes: Record<string, { background?: unknown }> };
    };
    doc.screen.nodes.root.background = { color: "#FFFFFF" };

    expect(migrateToV03(doc)).toBe(doc);
    expect(validateVisualSpec(doc).valid).toBe(false);
  });

  it("버전과 키의 짝이 안 맞는 문서는 버전을 올리지 않는다", () => {
    const screenWithProjectVersion = { ...legacyDashboard, version: "0.2" };
    const projectWithScreenVersion = { ...legacyTwoPage, version: "0.1" };

    expect(migrateToV03(screenWithProjectVersion)).toBe(screenWithProjectVersion);
    expect(migrateToV03(projectWithScreenVersion)).toBe(projectWithScreenVersion);
  });

  it.each([
    ["알 수 없는 버전", { version: "0.9", screen: {} }],
    ["screen이 객체가 아님", { version: "0.1", screen: 3 }],
    ["nodes가 배열", { version: "0.1", screen: { nodes: [] } }],
    ["pages가 객체가 아님", { version: "0.2", pages: "x" }],
  ])("%s — 깨진 부분은 그대로 두고 검증이 보고하게 한다", (_name, doc) => {
    const migrated = migrateToV03(doc) as Record<string, unknown>;
    const field = "screen" in doc ? "screen" : "pages";

    expect(migrated[field]).toBe((doc as Record<string, unknown>)[field]);
  });

  it.each([null, 3, "text", [1, 2]])("객체가 아닌 입력(%j)은 그대로 돌려준다", (input) => {
    expect(migrateToV03(input)).toBe(input);
  });
});

/**
 * 렌더가 같은가. 0.2까지의 렌더는 `background: <color>` 한 칸이었다. 0.3은 solid 한
 * 겹을 `backgroundColor: <color>` 하나로 낸다(canvasLayout.backgroundStyle — 맨 아래
 * solid는 background-color). 계산된 CSS로는 같은 값이다. 여기서는 **그 한 칸의
 * 이름 말고는 스타일이 하나도 안 바뀌었는지**를 본다 — develop의 렌더(옛 노드에서
 * 배경을 뺀 스타일 + `background: color`)와 변환한 노드의 스타일이 같아야 한다.
 */
describe("migrateToV03 — 렌더 스타일이 변환 전과 같다", () => {
  const STYLERS = {
    frame: [frameStyle, previewFrameStyle],
    button: [buttonStyle, previewButtonStyle],
    input: [inputStyle, previewInputStyle],
  } as const;

  function migratedNodes(screen: { nodes: Record<string, LegacyNode> }): ScreenSpec["nodes"] {
    const doc = { version: "0.1", screen };
    return (migrateToV03(doc) as VisualSpec).screen.nodes;
  }

  it("배경을 가진 노드가 픽스처에 충분히 있다", () => {
    const withBackground = legacyScreens().flatMap(({ screen }) =>
      Object.values(screen.nodes).filter((node) => node.background !== undefined),
    );
    // dashboard 3 · card-effects 4 · two-page 5
    expect(withBackground).toHaveLength(12);
  });

  for (const { name, screen } of legacyScreens()) {
    it(`${name}의 frame·button·input 스타일`, () => {
      const migrated = migratedNodes(screen);

      for (const [id, legacy] of Object.entries(screen.nodes)) {
        const type = legacy.type as Node["type"];
        if (!(type in STYLERS)) continue;

        const node = migrated[id];
        const { background: legacyBackground, ...withoutBackground } = legacy;

        for (const styler of STYLERS[type as keyof typeof STYLERS]) {
          // 미리보기 스타일은 이미지 src 바꾸기를 받는다 — 여기서는 원본을 그대로 쓴다(#322).
          const style = (n: Node, d: undefined) =>
            (styler as (n: Node, d: undefined, src: (s: string) => string) => Record<string, unknown>)(n, d, (s) => s);
          const before = {
            ...style(withoutBackground as unknown as Node, undefined),
            background: legacyBackground?.color,
          };
          const { backgroundColor, backgroundImage, backgroundOrigin, ...after } = style(
            node,
            undefined,
          );

          // 단색 한 겹은 이미지 겹 없이 background-color 하나다 — 디더링되는
          // linear-gradient(c, c)로 그리지 않는다.
          expect(backgroundImage, `${id} backgroundImage`).toBeUndefined();
          expect(backgroundOrigin, `${id} backgroundOrigin`).toBeUndefined();
          expect({ ...after, background: backgroundColor }, id).toEqual(before);
        }
      }
    });
  }
});

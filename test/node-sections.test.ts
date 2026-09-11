import { describe, expect, it } from "vitest";

import { visualSpecJsonSchema } from "@/features/editor/schema";
import {
  coveredNodeTypes,
  hasShadow,
  sectionsFor,
  type NodeType,
  type SectionId,
} from "@/features/editor/ui/properties/nodeSections";

/** 정본 스키마의 $defs.Node.oneOf 가 실제로 인정하는 타입 문자열들. */
function schemaNodeTypes(): string[] {
  const schema = visualSpecJsonSchema as {
    $defs: { Node: { oneOf: { $ref: string }[] } };
  };

  return schema.$defs.Node.oneOf.map((branch) => {
    const defName = branch.$ref.replace("#/$defs/", "");
    const node = (
      visualSpecJsonSchema as unknown as {
        $defs: Record<string, { properties: { type: { const: string } } }>;
      }
    ).$defs[defName];
    return node.properties.type.const;
  });
}

describe("노드 타입별 섹션 표", () => {
  it("스키마에 있는 노드 타입 다섯을 하나도 빠뜨리지 않는다", () => {
    // 이 테스트가 이 리팩터의 목적 자체다. 새 노드 타입을 스키마에 넣고 표에
    // 등록하지 않으면 여기서 걸린다 — image·button·input 이 "지원하지 않습니다"
    // 안내문만 뜬 채 네 번(#67·#69·#83·#88) 방치된 것이 그 누락이었다.
    expect([...coveredNodeTypes()].sort()).toEqual([...schemaNodeTypes()].sort());
  });

  it("모든 타입이 Size를 갖는다 — box는 다섯 타입 공통 필수 필드다", () => {
    for (const type of coveredNodeTypes()) {
      expect(sectionsFor(type)).toContain("size");
    }
  });

  it("Layout은 frame만 갖는다 — layout 필드가 있는 노드가 frame뿐이다", () => {
    const withLayout = coveredNodeTypes().filter((type) =>
      sectionsFor(type).includes("layout"),
    );

    expect(withLayout).toEqual(["frame"]);
  });

  it("frame만 Content가 없다 — 프레임은 자식이 곧 내용이다", () => {
    const withoutContent = coveredNodeTypes().filter(
      (type) => !sectionsFor(type).includes("content"),
    );

    expect(withoutContent).toEqual(["frame"]);
  });

  it("Typography와 Color는 늘 함께 온다 — 글꼴만 있고 글자색이 없는 타입은 없다", () => {
    for (const type of coveredNodeTypes()) {
      const sections = sectionsFor(type);
      expect(sections.includes("typography")).toBe(sections.includes("color"));
    }
  });

  it("Background와 Border도 늘 함께 온다 — 스키마에서 한 쌍으로 붙어 있다", () => {
    for (const type of coveredNodeTypes()) {
      const sections = sectionsFor(type);
      expect(sections.includes("background")).toBe(sections.includes("border"));
    }
  });

  it("button·input에는 Effects가 없다 — 빠뜨린 게 아니라 스키마에 필드가 없다", () => {
    // opacity·blur 를 두 타입에 넣지 않은 이유가 "패널이 없어서"였다. 패널이
    // 생긴 지금은 스키마를 넓힐 수 있지만 동결 규칙을 타야 해서 별도 작업이다.
    // 그때 이 테스트가 함께 바뀌어야 한다는 표시로 남긴다.
    expect(sectionsFor("button")).not.toContain("effects");
    expect(sectionsFor("input")).not.toContain("effects");
  });

  it("그림자는 frame에만 붙는다", () => {
    expect(hasShadow("frame")).toBe(true);
    for (const type of coveredNodeTypes().filter((t) => t !== "frame")) {
      expect(hasShadow(type)).toBe(false);
    }
  });

  it("섹션이 중복되지 않는다", () => {
    for (const type of coveredNodeTypes()) {
      const sections = sectionsFor(type);
      expect(new Set(sections).size).toBe(sections.length);
    }
  });

  it("화면 순서 — 무엇인가(content) 다음에 얼마나 큰가(size)가 온다", () => {
    for (const type of coveredNodeTypes()) {
      const sections = sectionsFor(type) as SectionId[];
      const content = sections.indexOf("content");
      if (content === -1) continue;
      expect(content).toBeLessThan(sections.indexOf("size"));
    }
  });

  it("리팩터 전 frame·text의 섹션 구성을 그대로 유지한다 — 회귀 방지", () => {
    // FrameProperties / TextProperties 가 띄우던 순서와 같아야 한다.
    // (text의 Color만 Effects 위로 한 칸 올라갔다 — 글꼴 바로 아래가 맞다고 봤다)
    expect(sectionsFor("frame" as NodeType)).toEqual([
      "layout",
      "size",
      "background",
      "border",
      "effects",
    ]);
    expect(sectionsFor("text" as NodeType)).toEqual([
      "content",
      "size",
      "typography",
      "color",
      "effects",
    ]);
  });

  it("새로 편집할 수 있게 된 세 타입이 실제로 섹션을 갖는다", () => {
    expect(sectionsFor("image")).toEqual(["content", "size", "effects"]);
    expect(sectionsFor("button")).toEqual([
      "content",
      "size",
      "typography",
      "color",
      "background",
      "border",
    ]);
    expect(sectionsFor("input")).toEqual([
      "content",
      "size",
      "typography",
      "color",
      "background",
      "border",
    ]);
  });
});

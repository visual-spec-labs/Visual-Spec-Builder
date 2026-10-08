import { describe, expect, it } from "vitest";

import type { ImageNode, ScreenSpec } from "@/features/editor/schema";
import { PREVIEW_NODE_LIMIT, previewImageStyle, previewNodeIds, previewScale } from "@/features/editor/ui/homePreview";

describe("previewScale", () => {
  it("콘텐츠가 박스보다 크면 축소한다", () => {
    // 1440x900을 208x140 박스에 — 가로 기준 208/1440, 세로 기준 140/900 중 더 작은 쪽
    expect(previewScale(1440, 900, 208, 140)).toBeCloseTo(
      Math.min(208 / 1440, 140 / 900),
    );
  });

  it("콘텐츠가 박스보다 작으면 확대한다(잘리지 않게 맞춘다)", () => {
    expect(previewScale(100, 100, 208, 140)).toBeCloseTo(1.4);
  });

  it("콘텐츠 크기가 0 이하면 1을 반환한다", () => {
    expect(previewScale(0, 900, 208, 140)).toBe(1);
    expect(previewScale(1440, 0, 208, 140)).toBe(1);
    expect(previewScale(-10, 900, 208, 140)).toBe(1);
  });
});

describe("previewImageStyle — url() 인용", () => {
  function image(src: string): ImageNode {
    return {
      type: "image",
      name: "Photo",
      box: { width: "fill", height: 120 },
      src,
      fit: "cover",
    };
  }

  it("경로에 공백이 있어도 유효한 CSS 값을 만든다", () => {
    // 인용하지 않은 url() 토큰에는 공백이 못 들어간다. 값 전체가 무효가 되어
    // CSSOM 이 조용히 버리므로, 오류 하나 없이 미리보기 이미지만 사라졌다.
    // 작업공간 상대 경로는 파일 라우트를 거쳐 나간다(#133 — imageSrc.ts의 resolveImageSrc).
    // PR #145 리뷰 이후로는 세그먼트마다 URL 인코딩까지 한다 — 공백은 `%20`이 된다.
    const style = previewImageStyle(image("assets/hero image.png"), "column");

    expect(style.backgroundImage).toBe('url("/__vs/file/assets/hero%20image.png")');
  });

  it("#이 든 이름도 미리보기에서 살아남는다 (PR #145 리뷰)", () => {
    // 인코딩하지 않으면 `#`부터가 조각이라 서버에 `hero`까지만 닿는다.
    const style = previewImageStyle(image("assets/hero#1.png"), "column");

    expect(style.backgroundImage).toBe('url("/__vs/file/assets/hero%231.png")');
  });

  it("따옴표와 역슬래시를 이스케이프해 문자열을 못 닫게 한다", () => {
    const style = previewImageStyle(image('/a"b\\c.png'), "column");

    expect(style.backgroundImage).toBe('url("/a\\"b\\\\c.png")');
  });
});

describe("previewNodeIds (#315)", () => {
  const text = (content: string, visible?: boolean) => ({
    type: "text", name: content, box: { width: "fill", height: "auto" }, content, color: "#000000",
    typography: { fontFamily: "Pretendard", fontSize: 14, fontWeight: 400, lineHeight: 20, letterSpacing: 0, textAlign: "left" },
    ...(visible === undefined ? {} : { visible }),
  });
  const frame = (children: string[], visible?: boolean) => ({
    type: "frame", name: "F", box: { width: "fill", height: "auto" },
    layout: { direction: "column", gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, mainAxis: "start", crossAxis: "stretch" },
    children: children.map((node) => ({ node })), ...(visible === undefined ? {} : { visible }),
  });
  const page = (nodes: Record<string, unknown>): ScreenSpec =>
    ({ name: "P", size: { width: 1440, height: 900 }, root: "root", nodes }) as unknown as ScreenSpec;

  it("그리는 순서(깊이 우선, 자식 배열 순)로 고른다", () => {
    const spec = page({
      root: frame(["a", "b"]), a: frame(["a1", "a2"]), a1: text("a1"), a2: text("a2"), b: text("b"),
    });
    expect([...previewNodeIds(spec)]).toEqual(["root", "a", "a1", "a2", "b"]);
    expect([...previewNodeIds(spec, 3)]).toEqual(["root", "a", "a1"]);
  });

  it("숨긴 노드와 그 아래, 없는 자식 참조는 세지 않는다", () => {
    const spec = page({
      root: frame(["hidden", "missing", "shown"]), hidden: frame(["inner"], false), inner: text("inner"), shown: text("shown"),
    });
    expect([...previewNodeIds(spec, 3)]).toEqual(["root", "shown"]);
  });

  it("기본 상한은 PREVIEW_NODE_LIMIT이다 — 큰 페이지도 그 수만 그린다", () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `t${i}`);
    const spec = page({ root: frame(ids), ...Object.fromEntries(ids.map((id) => [id, text(id)])) });
    const picked = previewNodeIds(spec);
    expect(picked.size).toBe(PREVIEW_NODE_LIMIT);
    expect(picked.has("t0")).toBe(true);
    expect(picked.has("t999")).toBe(false);
  });
});


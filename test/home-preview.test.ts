import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ImageNode, ScreenSpec } from "@/features/editor/schema";
import { previewImageStyle, previewScale } from "@/features/editor/ui/homePreview";
import { ProjectPreview } from "@/features/editor/ui/HomeScreen";

/** 축소본 없이 원본을 그대로 쓰는 경우(SVG·축소 실패) — 예전 동작과 같다. */
const original = (src: string) => src;

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
    const style = previewImageStyle(image("assets/hero image.png"), "column", original);

    expect(style.backgroundImage).toBe('url("/__vs/file/assets/hero%20image.png")');
  });

  it("#이 든 이름도 미리보기에서 살아남는다 (PR #145 리뷰)", () => {
    // 인코딩하지 않으면 `#`부터가 조각이라 서버에 `hero`까지만 닿는다.
    const style = previewImageStyle(image("assets/hero#1.png"), "column", original);

    expect(style.backgroundImage).toBe('url("/__vs/file/assets/hero%231.png")');
  });

  it("따옴표와 역슬래시를 이스케이프해 문자열을 못 닫게 한다", () => {
    const style = previewImageStyle(image('/a"b\\c.png'), "column", original);

    expect(style.backgroundImage).toBe('url("/a\\"b\\\\c.png")');
  });
});

// S1-5: recovery cards must not promote modal/widget to an ordinary page cover.
describe("homeCoverPage", () => {
  it("uses the first actual page without changing order, including omitted kind", async () => {
    const { homeCoverPage } = await import("@/features/editor/ui/homePreview");
    const { default: fixture } = await import("./fixtures/screen-relations-project.json");
    const spec = structuredClone(fixture) as unknown as import("@/features/editor/schema").ProjectSpec;
    spec.pageOrder = ["resetPassword", "login", "dashboard"];
    const before = structuredClone(spec);
    expect(homeCoverPage(spec)).toBe(spec.pages.login);
    expect(spec).toEqual(before);
    spec.pages.login.kind = "page";
    expect(homeCoverPage(spec)).toBe(spec.pages.login);
    spec.pages.login.kind = "widget";
    expect(homeCoverPage(spec)).toBe(spec.pages.dashboard);
    spec.pages.dashboard.kind = "modal";
    expect(homeCoverPage(spec)).toBeUndefined();
  });
});

// #439: base는 모바일 값, desktop ≥768 재정의로 가로 배치·배경 이미지를 둔 화면의 홈 썸네일이
// 실제 1440 캔버스(desktop 재정의 적용)와 같은 배치로 나오는지 고정한다.
describe("ProjectPreview — 썸네일의 반응형 해석 (#439)", () => {
  function page(): ScreenSpec {
    return {
      name: "Home",
      size: { width: 1440, height: 900 },
      root: "root",
      nodes: {
        root: {
          type: "frame",
          name: "Root",
          box: { width: "fill", height: "fill" },
          layout: { direction: "column", gap: 16, padding: { top: 0, right: 0, bottom: 0, left: 0 }, mainAxis: "start", crossAxis: "stretch" },
          children: [{ node: "order" }],
        },
        order: {
          type: "button",
          name: "Order",
          box: { width: "auto", height: 40 },
          content: "주문하기",
          typography: { fontFamily: "Inter", fontSize: 14, fontWeight: 600, lineHeight: 20, letterSpacing: 0, textAlign: "left" },
          color: "#FFFFFF",
          background: [{ type: "solid", color: "#2563EB" }],
        },
      },
      // base(위 nodes)는 column 배치·배경 없음이다. desktop(≥768)만 가로 배치와 배경 이미지 겹을 더한다 —
      // 고객 A가 만든 스펙과 같은 모양이다.
      responsive: {
        breakpoints: { desktop: { minWidthPx: 768 } },
        overrides: {
          desktop: {
            root: {
              layout: { direction: "row" },
              background: [{ type: "image", src: "assets/hero.png", fit: "cover" }],
            },
          },
        },
      },
    };
  }

  function render(spec: ScreenSpec): string {
    return renderToStaticMarkup(createElement(ProjectPreview, { page: spec, scrollRoot: null, drawn: false, onDrawn: () => {} }));
  }

  it("1440 페이지 크기는 desktop 재정의(가로 배치)를 쓴다 — base(column)를 그대로 쓰지 않는다", () => {
    const markup = render(page());
    expect(markup).toContain("flex-direction:row");
    expect(markup).not.toContain("flex-direction:column");
  });

  it("desktop 재정의에만 있는 배경 이미지 겹도 반영한다 — base에는 배경이 없다", () => {
    const markup = render(page());
    expect(markup).toContain('data-preview-image="1"');
  });

  it("폭이 desktop 분기점보다 좁은 페이지는 base(column)를 그대로 쓴다", () => {
    const spec = page();
    spec.size = { width: 600, height: 900 };
    const markup = render(spec);
    expect(markup).toContain("flex-direction:column");
    expect(markup).not.toContain('data-preview-image="1"');
  });
});

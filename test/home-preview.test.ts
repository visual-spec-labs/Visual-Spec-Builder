import { describe, expect, it } from "vitest";

import type { ImageNode } from "@/features/editor/schema";
import { previewImageStyle, previewScale } from "@/features/editor/ui/homePreview";

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
    const style = previewImageStyle(image("assets/hero image.png"), "column");

    expect(style.backgroundImage).toBe('url("/__vs/file/assets/hero image.png")');
  });

  it("따옴표와 역슬래시를 이스케이프해 문자열을 못 닫게 한다", () => {
    const style = previewImageStyle(image('/a"b\\c.png'), "column");

    expect(style.backgroundImage).toBe('url("/a\\"b\\\\c.png")');
  });
});

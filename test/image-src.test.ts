import { describe, expect, it } from "vitest";

import {
  describeImageSrc,
  imageUrlCss,
} from "@/features/editor/ui/properties/imageSrc";

describe("describeImageSrc", () => {
  it("assets 상대 경로는 그대로 편집칸에 준다", () => {
    expect(describeImageSrc("assets/hero.png")).toEqual({
      kind: "path",
      value: "assets/hero.png",
    });
  });

  it("값이 없으면 빈 경로로 본다 — 칸을 비워 두고 입력을 받는다", () => {
    expect(describeImageSrc(undefined)).toEqual({ kind: "path", value: "" });
    expect(describeImageSrc("")).toEqual({ kind: "path", value: "" });
  });

  it("data URI는 편집칸 대신 요약으로 바꾼다", () => {
    // Import 는 작업공간 assets 저장소가 없어 파일 전체를 base64로 넣는다.
    // 수백 KB짜리 한 줄을 입력칸에 띄우면 칸이 먹통이 되고 고칠 수도 없다.
    const result = describeImageSrc(`data:image/png;base64,${"A".repeat(2048)}`);

    expect(result.kind).toBe("data");
    expect(result).toHaveProperty("label");
  });

  it("요약에 미디어 타입과 크기가 들어간다", () => {
    const result = describeImageSrc(`data:image/jpeg;base64,${"A".repeat(2048)}`);

    if (result.kind !== "data") throw new Error("data URI로 판정돼야 한다");
    expect(result.label).toContain("image/jpeg");
    expect(result.label).toContain("KB");
  });

  it("크기 단위를 값에 맞춰 고른다", () => {
    const small = describeImageSrc(`data:image/png;base64,${"A".repeat(10)}`);
    const large = describeImageSrc(`data:image/png;base64,${"A".repeat(2_000_000)}`);

    if (small.kind !== "data" || large.kind !== "data") {
      throw new Error("둘 다 data URI로 판정돼야 한다");
    }
    expect(small.label).toContain(" B");
    expect(large.label).toContain("MB");
  });

  it("미디어 타입이 없는 data URI도 다룬다", () => {
    const result = describeImageSrc("data:,hello");

    if (result.kind !== "data") throw new Error("data URI로 판정돼야 한다");
    expect(result.label).toContain("이미지");
  });

  it("'data'로 시작하지만 URI가 아닌 경로는 경로로 본다", () => {
    // assets/data-2026.png 같은 파일명이 걸리면 안 된다.
    expect(describeImageSrc("assets/data-2026.png").kind).toBe("path");
    expect(describeImageSrc("data/hero.png").kind).toBe("path");
  });
});

describe("imageUrlCss", () => {
  it("항상 따옴표로 감싼다", () => {
    expect(imageUrlCss("assets/hero.png")).toBe('url("assets/hero.png")');
  });

  it("공백이 든 파일명이 살아남는다", () => {
    // 따옴표 없는 url() 토큰에는 공백이 들어갈 수 없다(CSS 명세). 감싸지 않으면
    // 값 전체가 무효가 되어 CSSOM이 조용히 버리고, 이미지가 오류 없이 사라진다.
    expect(imageUrlCss("assets/my image.png")).toBe('url("assets/my image.png")');
  });

  it("괄호가 든 파일명도 살아남는다 — assets/hero (1).png 같은 흔한 이름이다", () => {
    expect(imageUrlCss("assets/hero (1).png")).toBe('url("assets/hero (1).png")');
  });

  it("따옴표는 이스케이프해 감싸기를 깨뜨리지 않게 한다", () => {
    expect(imageUrlCss('a"b.png')).toBe('url("a\\"b.png")');
  });

  it("역슬래시를 먼저 이스케이프해 따옴표 이스케이프를 무효화하지 않는다", () => {
    expect(imageUrlCss("a\\b.png")).toBe('url("a\\\\b.png")');
    expect(imageUrlCss('a\\"b.png')).toBe('url("a\\\\\\"b.png")');
  });

  it("data URI도 그대로 감싼다 — 쉼표·세미콜론이 들어 있다", () => {
    expect(imageUrlCss("data:image/png;base64,AAA")).toBe(
      'url("data:image/png;base64,AAA")',
    );
  });
});

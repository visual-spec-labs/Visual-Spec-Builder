import { describe, expect, it } from "vitest";

import {
  describeImageSrc,
  imageUrlCss,
  resolveImageSrc,
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

describe("resolveImageSrc", () => {
  it("작업공간 상대 경로 앞에 파일 라우트를 붙인다 — 개발 서버의 cwd는 이 패키지 루트라 그냥 두면 404다 (#133)", () => {
    expect(resolveImageSrc("assets/hero.png")).toBe("/__vs/file/assets/hero.png");
  });

  it("data URI는 그대로 둔다 — #133 이전에 Import한 기존 스펙이 계속 열리고 그려져야 한다", () => {
    expect(resolveImageSrc("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
  });

  it("스킴이 있는 URL과 절대 경로는 그대로 둔다", () => {
    expect(resolveImageSrc("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(resolveImageSrc("blob:http://localhost/abc")).toBe("blob:http://localhost/abc");
    expect(resolveImageSrc("/public/hero.png")).toBe("/public/hero.png");
  });

  it("빈 값은 그대로 둔다 — 라우트만 남은 URL을 만들지 않는다", () => {
    expect(resolveImageSrc("")).toBe("");
  });

  /**
   * 특수문자가 든 파일 이름 (PR #145 리뷰, wook3964).
   *
   * 저장 요청은 `workspaceFileUrl`로 세그먼트를 인코딩해 보내는데 그리는 쪽만 상대
   * 경로를 그대로 이어 붙이고 있었다 — Import는 성공하고 파일도 남는데 **화면에서만
   * 이미지가 안 보였다.** 저장 경로와 렌더 경로가 같은 URL을 만들어야 한다.
   */
  describe("URL에서 뜻을 갖는 글자가 든 이름", () => {
    it("#은 인코딩한다 — 그대로 두면 조각(fragment)이라 서버에 hero까지만 닿는다", () => {
      expect(resolveImageSrc("assets/hero#1.png")).toBe("/__vs/file/assets/hero%231.png");
    });

    it("%는 인코딩한다 — 그대로 두면 깨진 퍼센트 인코딩이라 서버가 거부한다", () => {
      expect(resolveImageSrc("assets/100%.png")).toBe("/__vs/file/assets/100%25.png");
    });

    it("공백·더하기·물음표도 인코딩한다", () => {
      expect(resolveImageSrc("assets/my image.png")).toBe("/__vs/file/assets/my%20image.png");
      expect(resolveImageSrc("assets/a+b.png")).toBe("/__vs/file/assets/a%2Bb.png");
      // 인코딩은 여기까지다 — `?`가 든 이름은 미들웨어가 정책으로 따로 거부한다
      // (workspacePath.ts의 FORBIDDEN_IN_SEGMENT). URL을 만드는 규칙과 받아줄지
      // 정하는 규칙은 서로 다른 자리에 있다.
      expect(resolveImageSrc("assets/what?.png")).toBe("/__vs/file/assets/what%3F.png");
    });

    it("한글 이름도 인코딩해 보낸다 — 미들웨어가 세그먼트마다 디코딩한다", () => {
      expect(resolveImageSrc("assets/표지.png")).toBe(
        `/__vs/file/assets/${encodeURIComponent("표지.png")}`,
      );
    });

    it("경로 구분자는 살린다 — 세그먼트마다 인코딩하기 때문이다", () => {
      expect(resolveImageSrc("generated/pages/a b.tsx")).toBe(
        "/__vs/file/generated/pages/a%20b.tsx",
      );
    });
  });
});

describe("imageUrlCss", () => {
  it("항상 따옴표로 감싸고, 작업공간 경로는 파일 라우트로 바꾼다", () => {
    expect(imageUrlCss("assets/hero.png")).toBe('url("/__vs/file/assets/hero.png")');
  });

  it("공백이 든 작업공간 경로는 인코딩돼 나간다", () => {
    expect(imageUrlCss("assets/my image.png")).toBe('url("/__vs/file/assets/my%20image.png")');
  });

  it("따옴표로 감싸는 것은 그대로다 — 인코딩하지 않는 절대 경로에 공백이 들 수 있다", () => {
    // 따옴표 없는 url() 토큰에는 공백이 들어갈 수 없다(CSS 명세). 감싸지 않으면
    // 값 전체가 무효가 되어 CSSOM이 조용히 버리고, 이미지가 오류 없이 사라진다.
    // 작업공간 경로는 이제 인코딩돼 공백이 남지 않지만, `/public/...`처럼 그대로
    // 두는 경로는 여전히 이 감싸기에만 기댄다.
    expect(imageUrlCss("/public/my image.png")).toBe('url("/public/my image.png")');
  });

  it("괄호가 든 파일명도 살아남는다 — assets/hero (1).png 같은 흔한 이름이다", () => {
    // encodeURIComponent는 괄호를 건드리지 않는다. URL에서 안전한 글자라 그대로 둔다.
    expect(imageUrlCss("assets/hero (1).png")).toBe('url("/__vs/file/assets/hero%20(1).png")');
  });

  it("#이 든 이름도 감싸기와 인코딩을 함께 거친다", () => {
    expect(imageUrlCss("assets/hero#1.png")).toBe('url("/__vs/file/assets/hero%231.png")');
  });

  it("따옴표는 이스케이프해 감싸기를 깨뜨리지 않게 한다", () => {
    expect(imageUrlCss('/a"b.png')).toBe('url("/a\\"b.png")');
  });

  it("역슬래시를 먼저 이스케이프해 따옴표 이스케이프를 무효화하지 않는다", () => {
    expect(imageUrlCss("/a\\b.png")).toBe('url("/a\\\\b.png")');
    expect(imageUrlCss('/a\\"b.png')).toBe('url("/a\\\\\\"b.png")');
  });

  it("data URI도 그대로 감싼다 — 쉼표·세미콜론이 들어 있다", () => {
    expect(imageUrlCss("data:image/png;base64,AAA")).toBe(
      'url("data:image/png;base64,AAA")',
    );
  });
});

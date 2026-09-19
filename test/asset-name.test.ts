import { describe, expect, it } from "vitest";

import { sanitizeAssetFileName, uniqueAssetName } from "@/features/workspace/assetName";

/** Import한 이미지를 .visual-spec/assets/ 에 어떤 이름으로 둘지 (이슈 #133). */

describe("sanitizeAssetFileName", () => {
  it("평범한 이름은 그대로 둔다", () => {
    expect(sanitizeAssetFileName("hero.png")).toBe("hero.png");
  });

  it("확장자는 소문자로 맞춘다 — 카메라가 만든 .JPG", () => {
    expect(sanitizeAssetFileName("IMG_0001.JPG")).toBe("IMG_0001.jpg");
  });

  it("공백은 하이픈으로 바꾼다", () => {
    expect(sanitizeAssetFileName("my hero image.png")).toBe("my-hero-image.png");
  });

  it("경로가 섞여 들어와도 파일 이름만 남긴다 — 폴더 업로드의 File.name", () => {
    expect(sanitizeAssetFileName("photos/2026/hero.png")).toBe("hero.png");
    expect(sanitizeAssetFileName("C:\\Users\\me\\hero.png")).toBe("hero.png");
  });

  it("경로 구분자와 OS가 싫어하는 글자를 지운다 — 탈출 시도가 이름으로 남지 않는다", () => {
    expect(sanitizeAssetFileName("../../etc/passwd.png")).toBe("passwd.png");
    expect(sanitizeAssetFileName('a:b*c?d"e<f>g|h.png')).toBe("a-b-c-d-e-f-g-h.png");
  });

  it("허용 확장자가 아니면 null — 호출 측이 data URI 폴백으로 돌아간다", () => {
    expect(sanitizeAssetFileName("photo.heic")).toBeNull();
    expect(sanitizeAssetFileName("script.js")).toBeNull();
    expect(sanitizeAssetFileName("noextension")).toBeNull();
    expect(sanitizeAssetFileName(".png")).toBeNull();
    expect(sanitizeAssetFileName("")).toBeNull();
  });
});

describe("uniqueAssetName", () => {
  it("겹치지 않으면 그대로 쓴다", () => {
    expect(uniqueAssetName("hero.png", ["other.png"])).toBe("hero.png");
  });

  it("겹치면 번호를 붙인다 — 같은 이름을 덮어쓰면 그 이미지를 쓰던 다른 노드까지 바뀐다", () => {
    expect(uniqueAssetName("hero.png", ["hero.png"])).toBe("hero-1.png");
    expect(uniqueAssetName("hero.png", ["hero.png", "hero-1.png"])).toBe("hero-2.png");
  });

  it("대소문자를 무시하고 비교한다 — Windows·macOS 기본 파일 시스템이 그렇다", () => {
    expect(uniqueAssetName("Hero.png", ["hero.png"])).toBe("Hero-1.png");
  });
});

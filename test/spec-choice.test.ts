import { describe, expect, it } from "vitest";

import { resolveSpecChoice } from "@/features/editor/ui/specChoice";

/** File ▸ Open 의 `.visual-spec/specs/` 목록에서 하나 고르기 (이슈 #133). */

const NAMES = ["dashboard.json", "login.json", "Settings.json"];

describe("resolveSpecChoice", () => {
  it("번호로 고른다 — 목록을 번호와 함께 보여준다", () => {
    expect(resolveSpecChoice("1", NAMES)).toBe("dashboard.json");
    expect(resolveSpecChoice(" 3 ", NAMES)).toBe("Settings.json");
  });

  it("범위 밖 번호는 null", () => {
    expect(resolveSpecChoice("0", NAMES)).toBeNull();
    expect(resolveSpecChoice("4", NAMES)).toBeNull();
  });

  it("이름으로도 고른다. 대소문자와 .json 생략을 봐준다", () => {
    expect(resolveSpecChoice("login.json", NAMES)).toBe("login.json");
    expect(resolveSpecChoice("LOGIN", NAMES)).toBe("login.json");
    expect(resolveSpecChoice("settings", NAMES)).toBe("Settings.json");
  });

  it("목록에 없으면 null — 호출 측이 알리고 아무것도 열지 않는다", () => {
    expect(resolveSpecChoice("없는파일", NAMES)).toBeNull();
    expect(resolveSpecChoice("", NAMES)).toBeNull();
    expect(resolveSpecChoice("   ", NAMES)).toBeNull();
  });

  it("빈 목록에서는 무엇을 넣어도 null", () => {
    expect(resolveSpecChoice("1", [])).toBeNull();
    expect(resolveSpecChoice("home.json", [])).toBeNull();
  });
});

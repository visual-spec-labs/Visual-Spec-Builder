import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.doUnmock("node:path"); vi.resetModules(); });

it.each(["/", "\\"])("표시 경로만 정규화한다 (구분자 %s 모사)", async (sep) => {
  vi.doMock("node:path", async () => ({ ...await vi.importActual("node:path"), sep }));
  // @ts-expect-error — 컴파일 없는 순수 Node 스크립트라 타입 선언이 없다.
  const { displayPath } = await import("../bin/visual-spec.mjs");
  expect(displayPath(`.claude/skills/visual-spec${sep}references${sep}new.md`))
    .toBe(".claude/skills/visual-spec/references/new.md");
  expect(displayPath(".agents/skills/visual-spec/SKILL.md")).toBe(".agents/skills/visual-spec/SKILL.md");
  if (sep === "/") expect(displayPath("literal\\name.md")).toBe("literal\\name.md");
});

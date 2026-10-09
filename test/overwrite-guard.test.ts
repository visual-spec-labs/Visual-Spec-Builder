import { describe, expect, it } from "vitest";

import { contentHash, sha256Hex } from "@/features/editor/export/contentHash";
import type { ManifestEntry } from "@/features/editor/export/generationManifest";
import { diffLines } from "@/features/editor/export/lineDiff";
import {
  classifyOverwrite,
  needsDecision,
  shouldWrite,
  type FileSnapshot,
  type OverwriteOwner,
} from "@/features/editor/export/overwriteGuard";

/** 쓰기 전 판정과 확인 화면 diff — 순수 함수 (이슈 #282). */

const L = "export function Header() { return <header>L</header>; }\n";
const M = "export function Header() { return <header>M</header>; }\n";
const N = "export function Header() { return <header>N</header>; }\n";

function snapshot(text: string): FileSnapshot {
  const bytes = new TextEncoder().encode(text);
  return { bytes, revision: sha256Hex(bytes) };
}

function record(overrides: Partial<ManifestEntry> = {}): ManifestEntry {
  return {
    requestId: "req-1", ticketId: "Header", pageId: "home", inputFingerprint: "sha256:x",
    contentHash: contentHash(L), acceptedAt: "2026-10-10T00:00:00.000Z", projectKey: "shop.json",
    ...overrides,
  };
}

const owner: OverwriteOwner = { projectKey: "shop.json", pageId: "home" };
const classify = (current: FileSnapshot | null, entry: ManifestEntry | null, who: OverwriteOwner = owner) =>
  classifyOverwrite({ path: "components/Header.tsx", ticketId: "Header", current, next: N, record: entry, owner: who }).ownership;

describe("classifyOverwrite", () => {
  it("파일이 없으면 new, 지금 바이트가 새 출력과 같으면 unchanged", () => {
    expect(classify(null, record())).toBe("new");
    expect(classify(snapshot(N), null)).toBe("unowned");
    expect(classify(snapshot(N), record({ contentHash: contentHash(N) }))).toBe("unchanged");
    expect(classify(snapshot(N), record({ projectKey: "other.json" }))).toBe("foreign");
  });

  it("이 프로젝트·페이지의 기록과 바이트가 같으면 owned, 다르면 modified", () => {
    expect(classify(snapshot(L), record())).toBe("owned");
    expect(classify(snapshot(M), record())).toBe("modified");
  });

  it("기록이 없으면 unowned — 생성기 소유로 추정하지 않는다", () => {
    expect(classify(snapshot(L), null)).toBe("unowned");
  });

  it("다른 프로젝트·다른 페이지·프로젝트를 모르는 기록은 해시가 맞아도 foreign", () => {
    expect(classify(snapshot(L), record({ projectKey: "other.json" }))).toBe("foreign");
    expect(classify(snapshot(L), record({ pageId: "about" }))).toBe("foreign");
    expect(classify(snapshot(L), record({ projectKey: undefined }))).toBe("foreign"); // #284 시절 기록
    expect(classify(snapshot(L), record({ projectKey: null }))).toBe("foreign"); // 저장 안 한 문서의 기록
    expect(classify(snapshot(L), record(), { projectKey: null, pageId: "home" })).toBe("foreign");
  });

  it("BOM만 다른 바이트도 같은 파일로 보지 않는다", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(L)]);
    expect(classify({ bytes, revision: sha256Hex(bytes) }, record())).toBe("modified");
  });
});

describe("needsDecision · shouldWrite", () => {
  it("확인 대상은 modified·unowned·foreign뿐이고, 명시적으로 overwrite를 골라야만 쓴다", () => {
    expect((["new", "unchanged", "owned"] as const).map((ownership) => needsDecision({ ownership }))).toEqual([false, false, false]);
    expect((["modified", "unowned", "foreign"] as const).map((ownership) => needsDecision({ ownership }))).toEqual([true, true, true]);
    expect(shouldWrite({ ownership: "owned", path: "a" }, {})).toBe(true);
    expect(shouldWrite({ ownership: "new", path: "a" }, {})).toBe(true);
    expect(shouldWrite({ ownership: "unchanged", path: "a" }, { a: "overwrite" })).toBe(false);
    expect(shouldWrite({ ownership: "modified", path: "a" }, {})).toBe(false);
    expect(shouldWrite({ ownership: "modified", path: "a" }, { a: "keep" })).toBe(false);
    expect(shouldWrite({ ownership: "foreign", path: "a" }, { a: "overwrite" })).toBe(true);
  });
});

describe("diffLines", () => {
  it("바뀐 줄만 더함·지움으로 보이고 먼 같은 줄은 접는다", () => {
    const before = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].join("\n") + "\n";
    const after = before.replace("e\n", "E\n");
    const diff = diffLines(before, after, { context: 1 });
    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(1);
    expect(diff.lines).toEqual([
      { kind: "skip", count: 3 },
      { kind: "same", text: "d" },
      { kind: "remove", text: "e" },
      { kind: "add", text: "E" },
      { kind: "same", text: "f" },
      { kind: "skip", count: 4 },
    ]);
  });

  it("같은 내용이면 변경이 없고, 칸 수 상한을 넘으면 맞추지 않고 통째로 보인다", () => {
    expect(diffLines(L, L).added).toBe(0);
    const diff = diffLines("x\ny\n", "p\nq\n", { maxCells: 1 });
    expect(diff.approximate).toBe(true);
    expect(diff.removed).toBe(2);
    expect(diff.added).toBe(2);
  });

  it("가운데 삽입을 LCS로 맞춘다", () => {
    const diff = diffLines("a\nb\nc\n", "a\nx\nb\nc\n");
    expect(diff.lines).toEqual([
      { kind: "same", text: "a" },
      { kind: "add", text: "x" },
      { kind: "same", text: "b" },
      { kind: "same", text: "c" },
    ]);
  });
});

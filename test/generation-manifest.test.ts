import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { contentHash, inputFingerprint, sha256Hex } from "@/features/editor/export/contentHash";
import {
  classifyOutputFreshness,
  emptyManifest,
  GENERATION_MANIFEST_PROTOCOL,
  parseGenerationManifest,
  withManifestEntries,
  type GenerationManifest,
  type ManifestEntry,
} from "@/features/editor/export/generationManifest";
import { ticketFilePath } from "@/features/editor/export/generatedPaths";
import type { ScreenSpec } from "@/features/editor/schema";
import type { Ticket } from "@/features/editor/ticket/types";

/**
 * 생성 출력 수용 기록과 Export 생성 세대 판정 (이슈 #284) — 순수 함수만 본다.
 * 파일 I/O·시간은 쓰지 않는다. 실제 확정 경로는 `ticket-output-acceptance.test.ts`가 본다.
 */

const page: ScreenSpec = {
  name: "Home",
  size: { width: 390, height: 844 },
  root: "root",
  nodes: {
    root: {
      type: "frame",
      name: "Screen",
      box: { width: "fill", height: "fill" },
      layout: {
        direction: "column",
        gap: 8,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        mainAxis: "start",
        crossAxis: "stretch",
      },
      children: [],
    },
  },
};

function ticket(id: string, kind: Ticket["kind"] = "component"): Ticket {
  return { id, componentName: id, kind, instances: ["root"], dependsOn: [], status: "done" };
}

function entry(content: string, overrides: Partial<ManifestEntry> = {}): ManifestEntry {
  return {
    requestId: "req-b",
    ticketId: "Header",
    pageId: "home",
    inputFingerprint: inputFingerprint("home", page),
    contentHash: contentHash(content),
    acceptedAt: "2026-10-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("contentHash — 순수 TS SHA-256", () => {
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    // 두 블록(56바이트 이상)에 걸치는 표준 벡터
    [
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
  ])("표준 벡터 %j", (text, hex) => {
    expect(sha256Hex(new TextEncoder().encode(text))).toBe(hex);
  });

  it("한국어·긴 본문도 node:crypto와 같은 값이다(UTF-8 바이트 기준)", () => {
    for (const text of ["가나다", "export default function 로그인() {}\n".repeat(200), "x".repeat(55), "x".repeat(64)]) {
      expect(contentHash(text)).toBe(`sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`);
    }
  });

  it("입력 지문은 키 순서에 흔들리지 않고, 내용·pageId가 바뀌면 달라진다", () => {
    const reordered = JSON.parse(JSON.stringify({ root: page.root, nodes: page.nodes, size: page.size, name: page.name }));
    expect(inputFingerprint("home", reordered)).toBe(inputFingerprint("home", page));
    expect(inputFingerprint("other", page)).not.toBe(inputFingerprint("home", page));
    expect(inputFingerprint("home", { ...page, name: "Home B" })).not.toBe(inputFingerprint("home", page));
  });
});

describe("parseGenerationManifest — 예외를 던지지 않는다", () => {
  it.each([null, "", "{", "[]", JSON.stringify({ protocol: 99, entries: {} }), JSON.stringify({ protocol: 1 })])(
    "%j는 빈 기록이다",
    (text) => {
      expect(parseGenerationManifest(text)).toEqual(emptyManifest());
    },
  );

  it("모양이 틀린 항목 하나만 버린다", () => {
    const good = entry("B");
    const parsed = parseGenerationManifest(JSON.stringify({
      protocol: GENERATION_MANIFEST_PROTOCOL,
      entries: { "components/Header.tsx": good, "components/Card.tsx": { requestId: 1 } },
    }));
    expect(parsed.entries).toEqual({ "components/Header.tsx": good });
  });

  it("합치면 같은 경로의 이전 확정을 새 확정으로 바꾼다", () => {
    const before = withManifestEntries(emptyManifest(), { "components/Header.tsx": entry("A", { requestId: "req-a" }) });
    const after = withManifestEntries(before, { "components/Header.tsx": entry("B") });
    expect(after.entries["components/Header.tsx"].requestId).toBe("req-b");
  });
});

describe("classifyOutputFreshness — 파일 존재와 현재 세대 완료를 구분한다", () => {
  const header = ticket("Header");
  const card = ticket("Card");
  const headerPath = ticketFilePath(header);
  const cardPath = ticketFilePath(card);

  function classify(files: Record<string, string>, manifest: GenerationManifest, current: ScreenSpec = page) {
    return classifyOutputFreshness({
      tickets: [header, card],
      files: Object.entries(files).map(([path, content]) => ({ path, content })),
      manifest,
      pageId: "home",
      page: current,
    });
  }

  it("기록·해시·입력 지문이 모두 맞으면 현재다", () => {
    const report = classify(
      { [headerPath]: "B-header", [cardPath]: "B-card" },
      withManifestEntries(emptyManifest(), {
        [headerPath]: entry("B-header"),
        [cardPath]: entry("B-card", { ticketId: "Card" }),
      }),
    );
    expect(report.overall).toBe("current");
    expect(report.tickets.map((item) => item.freshness)).toEqual(["current", "current"]);
    expect(report.tickets[0].requestId).toBe("req-b");
  });

  it("파일이 있어도 수용 기록이 없으면(직접 실행·늦은 쓰기) 확인 불가다 — 4/4 존재만으로 현재가 아니다", () => {
    const report = classify({ [headerPath]: "late-A", [cardPath]: "late-A" }, emptyManifest());
    expect(report.tickets.map((item) => item.freshness)).toEqual(["unrecorded", "unrecorded"]);
    expect(report.overall).toBe("unverifiable");
  });

  it("확정 뒤 바이트가 바뀌면(늦은 A가 같은 경로를 덮음) 그 티켓은 changed, 전체는 부분이 아니라 확인 불가다", () => {
    const report = classify(
      { [headerPath]: "late-A", [cardPath]: "B-card" },
      withManifestEntries(emptyManifest(), {
        [headerPath]: entry("B-header"),
        [cardPath]: entry("B-card", { ticketId: "Card" }),
      }),
    );
    expect(report.tickets.map((item) => item.freshness)).toEqual(["changed", "current"]);
    expect(report.overall).toBe("unverifiable");
  });

  it("확정 뒤 입력이 바뀌면 오래됨이다", () => {
    const report = classify(
      { [headerPath]: "B-header" },
      withManifestEntries(emptyManifest(), { [headerPath]: entry("B-header") }),
      { ...page, name: "Home edited" },
    );
    expect(report.tickets.map((item) => item.freshness)).toEqual(["stale", "missing"]);
    expect(report.overall).toBe("stale");
  });

  it("일부만 현재면 부분이다", () => {
    const report = classify(
      { [headerPath]: "B-header" },
      withManifestEntries(emptyManifest(), { [headerPath]: entry("B-header") }),
    );
    expect(report.overall).toBe("partial");
  });

  it("아무 파일도 없으면 아직 없음, 티켓이 없으면 대상 없음이다", () => {
    expect(classify({}, emptyManifest()).overall).toBe("missing");
    expect(classifyOutputFreshness({ tickets: [], files: [], manifest: emptyManifest(), pageId: "home", page }).overall)
      .toBe("empty");
  });

  it("다른 페이지의 기록은 현재로 치지 않는다", () => {
    const report = classify(
      { [headerPath]: "B-header", [cardPath]: "B-card" },
      withManifestEntries(emptyManifest(), {
        [headerPath]: entry("B-header", { pageId: "other", inputFingerprint: inputFingerprint("other", page) }),
        [cardPath]: entry("B-card", { ticketId: "Card" }),
      }),
    );
    expect(report.tickets[0].freshness).toBe("stale");
    expect(report.overall).toBe("partial");
  });
});


it.each([false, true])("ZIP에 포함되는 추가 파일도 최신성 판정에 포함한다 (recorded=%s)", (recorded) => {
  const files = [{ path: "components/Header.tsx", content: "header" }, { path: "helpers.ts", content: "late" }];
  const manifest = withManifestEntries(emptyManifest(), {
    "components/Header.tsx": entry("header"),
    ...(recorded ? { "helpers.ts": entry("previous") } : {}),
  });
  expect(classifyOutputFreshness({ tickets: [ticket("Header")], files, manifest, pageId: "home", page }).overall).toBe("unverifiable");
});

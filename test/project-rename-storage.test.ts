import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrateV01 } from "@/features/editor/schema";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { parseStoredDocument, prepareProjectRename, projectStorageKey, publishProjectRename } from "@/features/editor/store/specStorage";
import { projectFileName } from "@/features/workspace/projectName";

const spec = migrateV01(blankSpec);
const entries = new Map<string, string>();
const source = `${projectStorageKey("old.json", "")}:rename`;
const target = `${projectStorageKey("New.json", "")}:rename`;
const setItem = vi.fn((key: string, value: string) => { entries.set(key, value); });
beforeEach(() => {
  entries.clear();
  setItem.mockReset();
  setItem.mockImplementation((key, value) => { entries.set(key, value); });
  vi.stubGlobal("localStorage", { getItem: (key: string) => entries.get(key) ?? null,
    setItem, removeItem: (key: string) => entries.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());

describe("durable rename barriers", () => {
  it("does not publish any redirect when reserving the second key exceeds quota", () => {
    setItem.mockImplementation((key, value) => {
      if (key === target) throw new Error("QuotaExceededError");
      entries.set(key, value);
    });
    expect(() => prepareProjectRename("old.json", spec, "New.json")).toThrow();
    expect(entries.size).toBe(0);
  });
  it("keeps a non-loadable source barrier if publication fails after disk rename", () => {
    prepareProjectRename("old.json", spec, "New.json");
    const barrier = entries.get(source)!;
    expect(barrier).toBeTruthy();
    expect(parseStoredDocument(barrier)).toBeUndefined();
    setItem.mockImplementation((key, value) => {
      if (key === source) throw new Error("QuotaExceededError");
      entries.set(key, value);
    });
    expect(() => publishProjectRename("old.json", spec, "New.json")).toThrow();
    expect(entries.get(source)).toBe(barrier);
    expect(parseStoredDocument(entries.get(target)!)).toBeUndefined();
  });
  it("reserves enough space and commits source before destination", () => {
    prepareProjectRename("old.json", spec, "New.json");
    const reserved = entries.get(source)!.length;
    setItem.mockClear();
    publishProjectRename("old.json", spec, "New.json");
    expect(setItem.mock.calls.map(([key]) => key)).toEqual([source, target]);
    expect(entries.get(source)!.length).toBeLessThanOrEqual(reserved);
    expect(parseStoredDocument(entries.get(source)!)).toEqual({ fileName: "New.json", spec });
  });
  it("restores previous notices after a confirmed rejection", () => {
    entries.set(source, "previous source");
    const rollback = prepareProjectRename("old.json", spec, "New.json");
    rollback();
    expect(entries.get(source)).toBe("previous source");
    expect(entries.has(target)).toBe(false);
  });
  it("shares storage and locking identity across portable case aliases", () => {
    expect(projectStorageKey("Project.json", "")).toBe(projectStorageKey("project.JSON", ""));
  });
});

describe("portable filename bytes", () => {
  it("counts UTF-8 bytes and the .json suffix", () => {
    expect(projectFileName("한".repeat(84))).toBeNull();
    expect(projectFileName("한".repeat(83))).toBe(`${"한".repeat(83)}.json`);
    expect(projectFileName(`${"한".repeat(83)}a`)).not.toBeNull();
    expect(projectFileName(`${"한".repeat(83)}ab`)).toBeNull();
  });
});

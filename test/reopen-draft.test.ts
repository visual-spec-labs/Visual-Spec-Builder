import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { parseStoredDocument, projectStorageKey } from "@/features/editor/store/specStorage";
import { openHomeProject } from "@/features/editor/ui/homeProjects";
import { openSpec } from "@/features/editor/ui/openSpecFromFile";
import { startSpecAutosave } from "@/features/editor/ui/specAutosave";
import { readWorkspaceSpecSnapshot } from "@/features/editor/ui/workspaceClient";

/**
 * 지금 연 파일을 Open·홈 카드로 다시 열 때도 미저장 초안이 디스크 원본에 덮이지 않는다
 * (#267 리뷰, PR #294). 파일명이 그대로라 파일 전환 비교를 타지 않던 경로다 — 실제
 * `openSpec`·`openHomeProject`를 그대로 부른다.
 */
vi.mock("@/features/editor/ui/workspaceClient", () => ({
  listWorkspaceFiles: vi.fn(async () => ["same.json"]),
  listWorkspaceFileEntries: vi.fn(async () => []),
  readWorkspaceSpecSnapshot: vi.fn(),
}));

function storage() {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); } };
}

const initial = useEditorStore.getState().spec;
const key = projectStorageKey("same.json", "unused");
const disk = (revision = "loaded-revision") => ({ text: JSON.stringify(initial), revision });
let stop: (() => void) | undefined;

function editPageName(name: string) {
  const editor = useEditorStore.getState();
  editor.setPageField(editor.activePageId, "name", name);
  return editor.activePageId;
}
const storedName = (pageId: string) => parseStoredDocument(localStorage.getItem(key))?.spec.pages[pageId].name;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  vi.stubGlobal("navigator", { locks: { request: async (_key: string, fn: () => void) => fn() } });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(),
    alert: vi.fn(), prompt: () => "same.json", confirm: vi.fn(() => true) });
  useEditorStore.getState().loadSpec(initial);
  useDocumentStore.getState().setFileName("same.json", "loaded-revision");
  useSaveConflictStore.setState({ paused: false, unavailable: false, reason: "remote" });
  vi.mocked(readWorkspaceSpecSnapshot).mockResolvedValue(disk());
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("같은 파일 다시 열기 (#267 리뷰)", () => {
  it("File → Open으로 같은 파일을 다시 열어도 debounce 뒤 편집본이 남고 초안 선택을 띄운다", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    const pageId = editPageName("Open 직전 편집");

    await openSpec();
    await vi.advanceTimersByTimeAsync(1000);

    expect(useSaveConflictStore.getState()).toMatchObject({ paused: true, reason: "draft" });
    expect(storedName(pageId)).toBe("Open 직전 편집");
    expect(await useSaveConflictStore.getState().loadLatest()).toBe(true);
    expect(useEditorStore.getState().spec.pages[pageId].name).toBe("Open 직전 편집");
  });

  it("홈 카드로 같은 프로젝트를 다시 골라도 debounce 뒤 편집본이 남고 초안 선택을 띄운다", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    const pageId = editPageName("홈 재선택 직전 편집");

    expect(await openHomeProject({ fileName: "same.json", spec: initial, diskRevision: "loaded-revision" })).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);

    expect(useSaveConflictStore.getState()).toMatchObject({ paused: true, reason: "draft" });
    expect(storedName(pageId)).toBe("홈 재선택 직전 편집");
  });

  it("초안을 버리기로 고르면 그때만 디스크 내용으로 바뀐다", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    const pageId = editPageName("버릴 편집");
    await openSpec();
    useSaveConflictStore.getState().discardDraft();
    await vi.advanceTimersByTimeAsync(500);
    expect(storedName(pageId)).toBe(initial.pages[pageId].name);
  });

  it("편집이 없으면 같은 파일을 다시 열어도 묻지 않는다", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    await openSpec();
    await vi.advanceTimersByTimeAsync(1000);
    expect(useSaveConflictStore.getState().paused).toBe(false);
  });

  it("그 사이 디스크가 바뀌었으면 초안이 아니라 충돌로 안내하고 초안은 덮지 않는다", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    const pageId = editPageName("디스크 변경 전 편집");
    vi.mocked(readWorkspaceSpecSnapshot).mockResolvedValue(disk("changed-on-disk"));
    await openSpec();
    await vi.advanceTimersByTimeAsync(1000);
    expect(useSaveConflictStore.getState()).toMatchObject({ paused: true, reason: "remote" });
    expect(storedName(pageId)).toBe("디스크 변경 전 편집");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { parseStoredDocument, projectStorageKey, saveSpecToStorage, serializeStoredDocument } from "@/features/editor/store/specStorage";
import { openHomeProject } from "@/features/editor/ui/homeProjects";
import { newSpec } from "@/features/editor/ui/newSpec";
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

  it("편집 뒤 디스크가 바뀌었어도 이 탭의 초안으로 묻고(다른 탭 안내 아님) 초안은 덮지 않는다", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    const pageId = editPageName("디스크 변경 전 편집");
    vi.mocked(readWorkspaceSpecSnapshot).mockResolvedValue(disk("changed-on-disk"));
    await openSpec();
    await vi.advanceTimersByTimeAsync(1000);
    expect(useSaveConflictStore.getState()).toMatchObject({ paused: true, reason: "draft" });
    expect(storedName(pageId)).toBe("디스크 변경 전 편집");
  });

  it("편집 없이 다시 열 때 디스크가 바뀌었으면 묻지 않고 새 디스크 내용으로 이어간다 (PR #294 리뷰)", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    const pageId = useEditorStore.getState().activePageId;
    const newer = { ...initial, pages: { ...initial.pages, [pageId]: { ...initial.pages[pageId], name: "외부에서 바뀜" } } };
    vi.mocked(readWorkspaceSpecSnapshot).mockResolvedValue({ text: JSON.stringify(newer), revision: "changed-on-disk" });
    await openSpec();
    await vi.advanceTimersByTimeAsync(1000);
    expect(useSaveConflictStore.getState().paused).toBe(false);
    expect(useEditorStore.getState().spec.pages[pageId].name).toBe("외부에서 바뀜");
    expect(storedName(pageId)).toBe("외부에서 바뀜");
  });

  it("편집했다가 되돌려 내용이 같으면 다시 열어도 묻지 않는다", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    editPageName("잠깐 바꿈");
    useEditorStore.getState().undo();
    await openSpec();
    await vi.advanceTimersByTimeAsync(1000);
    expect(useSaveConflictStore.getState().paused).toBe(false);
  });
});

describe("Web Locks가 없는 브라우저 (PR #294 리뷰)", () => {
  beforeEach(() => { vi.stubGlobal("navigator", {}); });

  it("편집이 없으면 New·Open·홈 카드 어디서도 변경 손실 확인을 띄우지 않는다", async () => {
    const confirm = vi.mocked(window.confirm);
    stop = startSpecAutosave();
    expect(await newSpec()).toBe(true);
    expect(await newSpec()).toBe(true);
    await openSpec();
    expect(await openHomeProject({ fileName: "same.json", spec: initial, diskRevision: "loaded-revision" })).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("편집이 있으면 기록되지 않은 변경을 버릴지 묻는다", async () => {
    const confirm = vi.mocked(window.confirm);
    stop = startSpecAutosave();
    editPageName("기록 못 한 편집");
    confirm.mockReturnValueOnce(false);
    expect(await newSpec()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });
});

describe("sessionStorage 없는 새 탭이 복원한 이름 있는 초안 (PR #294 리뷰)", () => {
  /**
   * 다른 탭(이미 닫힌)에서 same.json을 편집만 하고 디스크에 저장하지 않은 상태를 만든다.
   * 자동저장은 파일 키와 전역 캐시에 남고, 새 탭은 sessionStorage 복구 없이 전역 캐시에서
   * 편집본을 초기 화면으로 복원한다(`editorStore`의 `loadStoredSpec()`).
   */
  function restoreInFreshTab(name: string) {
    const pageId = useEditorStore.getState().activePageId;
    const draft = { ...initial, pages: { ...initial.pages, [pageId]: { ...initial.pages[pageId], name } } };
    localStorage.setItem(key, serializeStoredDocument({ fileName: "same.json", spec: draft, diskRevision: "loaded-revision" }));
    saveSpecToStorage(draft, "same.json", "loaded-revision");
    useEditorStore.getState().loadSpec(draft);
    useDocumentStore.getState().setFileName("same.json", "loaded-revision");
    return pageId;
  }

  it("추가 편집 없이 File → Open으로 같은 파일을 다시 열어도 초안을 묻고 debounce 뒤에도 남긴다", async () => {
    const pageId = restoreInFreshTab("다른 탭의 미저장 초안");
    stop = startSpecAutosave();

    await openSpec();
    await vi.advanceTimersByTimeAsync(1000);

    expect(useSaveConflictStore.getState()).toMatchObject({ paused: true, reason: "draft" });
    expect(storedName(pageId)).toBe("다른 탭의 미저장 초안");
    expect(await useSaveConflictStore.getState().loadLatest()).toBe(true);
    expect(useEditorStore.getState().spec.pages[pageId].name).toBe("다른 탭의 미저장 초안");
  });

  it("추가 편집 없이 같은 홈 카드를 다시 골라도 초안을 묻고 debounce 뒤에도 남긴다", async () => {
    const pageId = restoreInFreshTab("홈 재선택 전 미저장 초안");
    stop = startSpecAutosave();

    expect(await openHomeProject({ fileName: "same.json", spec: initial, diskRevision: "loaded-revision" })).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);

    expect(useSaveConflictStore.getState()).toMatchObject({ paused: true, reason: "draft" });
    expect(storedName(pageId)).toBe("홈 재선택 전 미저장 초안");
  });

  it("복원한 내용이 디스크와 같으면(저장된 문서) 다시 열어도 묻지 않는다", async () => {
    const pageId = restoreInFreshTab(initial.pages[useEditorStore.getState().activePageId].name);
    stop = startSpecAutosave();

    await openSpec();
    await vi.advanceTimersByTimeAsync(1000);

    expect(useSaveConflictStore.getState().paused).toBe(false);
    expect(storedName(pageId)).toBe(initial.pages[pageId].name);
  });

  it("초안을 버리고 디스크 내용으로 계속한 뒤에는 편집 없이 다시 열어도 묻지 않는다", async () => {
    restoreInFreshTab("버릴 초안");
    stop = startSpecAutosave();
    await openSpec();
    expect(useSaveConflictStore.getState().reason).toBe("draft");
    useSaveConflictStore.getState().discardDraft(); // 대화상자의 "저장된 파일 내용으로 계속"
    await vi.advanceTimersByTimeAsync(1000);

    await openSpec();
    await vi.advanceTimersByTimeAsync(1000);

    expect(useSaveConflictStore.getState().paused).toBe(false);
  });
});


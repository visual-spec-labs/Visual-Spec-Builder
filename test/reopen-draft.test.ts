import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { usePromptDialogStore } from "@/features/editor/store/promptDialogStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { parseStoredDocument, projectStorageKey, saveSpecToStorage, serializeStoredDocument } from "@/features/editor/store/specStorage";
import { openHomeProject } from "@/features/editor/ui/homeProjects";
import { newSpec } from "@/features/editor/ui/newSpec";
import { seedSpec } from "@/features/editor/store/seedSpec";
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

/**
 * `openSpec`은 `window.prompt`가 아니라 `promptPick` 모달을 쓴다(#288). 이 파일은
 * 가짜 타이머를 쓰므로(`vi.useFakeTimers()`) 다이얼로그가 열리기를 `vi.waitFor`로
 * 기다리는 대신, 이미 이 파일 전체가 쓰는 `vi.advanceTimersByTimeAsync(0)`로 마이크로
 * 태스크를 흘려보낸다 — `listWorkspaceFiles`의 mock resolve 뒤 `promptPick`이 여는
 * 그 한 틱이면 충분하다. 이 파일의 모든 Open은 같은 파일을 다시 여는 시나리오라
 * 답은 항상 "same.json" 하나다.
 */
async function openSpecSame(): Promise<void> {
  const pending = openSpec();
  await vi.advanceTimersByTimeAsync(0);
  usePromptDialogStore.getState().resolve("same.json");
  await pending;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  vi.stubGlobal("navigator", { locks: { request: async (_key: string, fn: () => void) => fn() } });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(),
    alert: vi.fn(), confirm: vi.fn(() => true) });
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

    await openSpecSame();
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
    await openSpecSame();
    useSaveConflictStore.getState().discardDraft();
    await vi.advanceTimersByTimeAsync(500);
    expect(storedName(pageId)).toBe(initial.pages[pageId].name);
  });

  it("편집이 없으면 같은 파일을 다시 열어도 묻지 않는다", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    await openSpecSame();
    await vi.advanceTimersByTimeAsync(1000);
    expect(useSaveConflictStore.getState().paused).toBe(false);
  });

  it("편집 뒤 디스크가 바뀌었어도 이 탭의 초안으로 묻고(다른 탭 안내 아님) 초안은 덮지 않는다", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    const pageId = editPageName("디스크 변경 전 편집");
    vi.mocked(readWorkspaceSpecSnapshot).mockResolvedValue(disk("changed-on-disk"));
    await openSpecSame();
    await vi.advanceTimersByTimeAsync(1000);
    expect(useSaveConflictStore.getState()).toMatchObject({ paused: true, reason: "draft" });
    expect(storedName(pageId)).toBe("디스크 변경 전 편집");
  });

  it("편집 없이 다시 열 때 디스크가 바뀌었으면 묻지 않고 새 디스크 내용으로 이어간다 (PR #294 리뷰)", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    const pageId = useEditorStore.getState().activePageId;
    const newer = { ...initial, pages: { ...initial.pages, [pageId]: { ...initial.pages[pageId], name: "외부에서 바뀜" } } };
    vi.mocked(readWorkspaceSpecSnapshot).mockResolvedValue({ text: JSON.stringify(newer), revision: "changed-on-disk" });
    await openSpecSame();
    await vi.advanceTimersByTimeAsync(1000);
    expect(useSaveConflictStore.getState().paused).toBe(false);
    expect(useEditorStore.getState().spec.pages[pageId].name).toBe("외부에서 바뀜");
    expect(storedName(pageId)).toBe("외부에서 바뀜");
  });

  it("편집했다가 되돌려 내용이 같으면 다시 열어도 묻지 않는다", async () => {
    stop = startSpecAutosave(); await vi.advanceTimersByTimeAsync(500);
    editPageName("잠깐 바꿈");
    useEditorStore.getState().undo();
    await openSpecSame();
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
    await openSpecSame();
    expect(await openHomeProject({ fileName: "same.json", spec: initial, diskRevision: "loaded-revision" })).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("편집이 있으면 기록되지 않은 변경을 버릴지 묻는다", async () => {
    const confirm = vi.mocked(window.confirm);
    stop = startSpecAutosave();
    editPageName("기록 못 한 편집");
    const pending = newSpec();
    await vi.advanceTimersByTimeAsync(0);
    expect(usePromptDialogStore.getState().state.kind).toBe("confirm");
    usePromptDialogStore.getState().resolve(null);
    expect(await pending).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
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

    await openSpecSame();
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

    await openSpecSame();
    await vi.advanceTimersByTimeAsync(1000);

    expect(useSaveConflictStore.getState().paused).toBe(false);
    expect(storedName(pageId)).toBe(initial.pages[pageId].name);
  });

  it("초안을 버리고 디스크 내용으로 계속한 뒤에는 편집 없이 다시 열어도 묻지 않는다", async () => {
    restoreInFreshTab("버릴 초안");
    stop = startSpecAutosave();
    await openSpecSame();
    expect(useSaveConflictStore.getState().reason).toBe("draft");
    useSaveConflictStore.getState().discardDraft(); // 대화상자의 "저장된 파일 내용으로 계속"
    await vi.advanceTimersByTimeAsync(1000);

    await openSpecSame();
    await vi.advanceTimersByTimeAsync(1000);

    expect(useSaveConflictStore.getState().paused).toBe(false);
  });
});

describe("편집하지 않은 첫 실행 데모 문서는 묻지 않는다 (#297)", () => {
  const login = { fileName: "same.json", spec: initial, diskRevision: "loaded-revision" };
  /** 첫 실행 화면 — 저장된 것 없이 데모 문서(seedSpec)가 제목 없는 문서로 뜬다. */
  function firstRunDemo() {
    useEditorStore.getState().loadSpec(seedSpec);
    useDocumentStore.getState().clearFileName();
  }

  it("첫 실행에서 StrictMode처럼 곧바로 재시작해도 홈 카드를 묻지 않고 연다", async () => {
    const confirm = vi.mocked(window.confirm);
    firstRunDemo();
    stop = startSpecAutosave();
    stop(); // React StrictMode(개발)는 마운트 직후 한 번 멈췄다가
    stop = startSpecAutosave(); // 같은 커밋 안에서 다시 시작한다

    expect(await openHomeProject(login)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().fileName).toBe("same.json");
  });

  it("데모 문서가 저장소에 남은 뒤 새로고침해도 묻지 않는다", async () => {
    const confirm = vi.mocked(window.confirm);
    firstRunDemo();
    saveSpecToStorage(useEditorStore.getState().spec, null); // 첫 실행 자동저장이 남긴 데모
    stop = startSpecAutosave();

    expect(await openHomeProject(login)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("재시작 직전에 편집했으면 이어받아 계속 묻는다 — 저장소 추측이 아니라 실제 편집 여부다", async () => {
    const confirm = vi.mocked(window.confirm);
    firstRunDemo();
    stop = startSpecAutosave();
    editPageName("데모를 고쳤다");
    stop();
    stop = startSpecAutosave();

    const pending = newSpec();
    await vi.advanceTimersByTimeAsync(0);
    expect(usePromptDialogStore.getState().state.kind).toBe("confirm");
    usePromptDialogStore.getState().resolve(null);
    expect(await pending).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  /**
   * 넘겨받는 값의 만료만 따로 본다(PR #300 리뷰). 문서 바이트는 그대로 두고 저장소만 비워
   * 저장소 기준 판정을 "편집 없음"으로 만든다 — 그래야 넘긴 값(편집 있음)이 쓰였는지가
   * 결과(확인 여부)를 가른다. 문서를 바꾸면 내용 불일치만으로 통과해 만료를 검증하지 못한다.
   */
  async function restartWithEditedUntitledAndEmptyStorage(awaitCommitEnd: boolean) {
    firstRunDemo();
    stop = startSpecAutosave();
    editPageName("앞 실행의 편집");
    stop();
    if (awaitCommitEnd) await Promise.resolve(); // 같은 커밋이 끝났다 — 이후 시작은 재시작이 아니다
    stop = undefined;
    vi.stubGlobal("sessionStorage", storage());
    vi.stubGlobal("localStorage", storage());
    stop = startSpecAutosave();
  }

  it("대조: 같은 조건에서 즉시 재시작하면 넘겨받은 편집 여부로 묻는다", async () => {
    const confirm = vi.mocked(window.confirm);
    await restartWithEditedUntitledAndEmptyStorage(false);
    const pending = newSpec();
    await vi.advanceTimersByTimeAsync(0);
    expect(usePromptDialogStore.getState().state.kind).toBe("confirm");
    usePromptDialogStore.getState().resolve(null);
    expect(await pending).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("넘겨받는 값은 같은 커밋이 끝나면 버려져, 그 뒤 시작은 저장소 판정을 따른다", async () => {
    const confirm = vi.mocked(window.confirm);
    await restartWithEditedUntitledAndEmptyStorage(true);
    expect(await newSpec()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  /**
   * 넘겨받는 값이 false인 경우를 직접 구분한다(PR #300 리뷰). 새로 연, 편집 없는 이름 있는
   * 문서는 탭 복구에 기록되므로 저장소 기준으로는 "복원한 문서 = 편집 있음"이다. 잠금이 없는
   * 브라우저에서 자동저장이 기록되지 않을 때 편집 여부가 전환 확인을 가르므로 그걸로 본다.
   */
  it("대조군: 편집 없이 연 이름 있는 문서는 즉시 재시작 때 false를 이어받고, 재시작이 아니면 저장소 판정을 따른다", async () => {
    const confirm = vi.mocked(window.confirm);
    vi.stubGlobal("navigator", {}); // 잠금 없음 — 자동저장이 기록되지 않는다
    firstRunDemo();
    stop = startSpecAutosave();
    expect(await openHomeProject(login)).toBe(true); // 새로 연, 편집 없는 이름 있는 문서

    stop();
    stop = startSpecAutosave(); // 즉시 재시작 — false를 이어받는다
    expect(await newSpec()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();

    expect(await openHomeProject(login)).toBe(true);
    stop();
    await Promise.resolve();
    stop = startSpecAutosave(); // 재시작이 아니다 — 탭 복구에서 복원한 문서로 판단한다
    const pending = newSpec();
    await vi.advanceTimersByTimeAsync(0);
    expect(usePromptDialogStore.getState().state.kind).toBe("confirm");
    usePromptDialogStore.getState().resolve(null);
    expect(await pending).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });
});


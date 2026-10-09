import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAgentEditStore } from "@/features/editor/store/agentEditStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { usePromptDialogStore } from "@/features/editor/store/promptDialogStore";
import { persistenceLabels, usePersistenceStatusStore } from "@/features/editor/store/persistenceStatusStore";
import { projectStorageKey, readRecovery, serializeStoredDocument, writeRecovery } from "@/features/editor/store/specStorage";
import { startSpecAutosave } from "@/features/editor/ui/specAutosave";
import { startDiskWatch } from "@/features/editor/ui/diskWatch";
import { saveSpec, saveSpecAs } from "@/features/editor/ui/exportSpecAsJson";
import { isWorkspaceAvailable, readWorkspaceSpecSnapshot, writeWorkspaceFile } from "@/features/editor/ui/workspaceClient";

vi.mock("@/features/editor/ui/workspaceClient", () => ({
  isWorkspaceAvailable: vi.fn(), readWorkspaceSpecSnapshot: vi.fn(), writeWorkspaceFile: vi.fn(),
}));
function storage() {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); }, key: (index: number) => [...map.keys()][index] ?? null,
    get length() { return map.size; } };
}
const initial = useEditorStore.getState().spec;
let disk: { text: string; revision: string };
let stops: (() => void)[];
let events: Map<string, (event: unknown) => void>;
function labels() {
  const { spec, documentId } = useEditorStore.getState();
  return persistenceLabels({ ...usePersistenceStatusStore.getState(), ...useDocumentStore.getState(),
    ...useSaveConflictStore.getState(), spec, documentId, json: JSON.stringify(spec) });
}
function edit(name = "수정한 페이지") { useEditorStore.getState().setPageField(useEditorStore.getState().activePageId, "name", name); }
async function start() {
  stops.push(startSpecAutosave(), startDiskWatch());
  await vi.advanceTimersByTimeAsync(3000);
}
beforeEach(() => {
  vi.useFakeTimers(); stops = []; events = new Map();
  vi.stubGlobal("localStorage", storage()); vi.stubGlobal("sessionStorage", storage());
  vi.stubGlobal("navigator", { locks: { request: async (_key: string, options: unknown, callback?: (lock: object) => unknown) => callback ? callback({}) : (options as () => unknown)() } });
  vi.stubGlobal("window", { alert: vi.fn(), addEventListener: (key: string, cb: (event: unknown) => void) => events.set(key, cb), removeEventListener: vi.fn() });
  vi.stubGlobal("performance", { getEntriesByType: () => [{ type: "reload" }] });
  useEditorStore.getState().loadSpec(structuredClone(initial));
  useDocumentStore.getState().setFileName("saved.json", "rev-1");
  useNavigationStore.getState().openEditor();
  useSaveConflictStore.setState({ paused: false, unavailable: false });
  usePersistenceStatusStore.setState({ disk: null, draft: null, attempt: null });
  disk = { text: JSON.stringify(initial), revision: "rev-1" };
  vi.mocked(isWorkspaceAvailable).mockResolvedValue(true);
  vi.mocked(readWorkspaceSpecSnapshot).mockImplementation(async () => disk);
  vi.mocked(writeWorkspaceFile).mockImplementation(async (path, text) => {
    disk = { text: text as string, revision: "rev-2" };
    return { ok: true, path, revision: disk.revision };
  });
});
afterEach(async () => { stops.reverse().forEach(stop => stop()); await Promise.resolve(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("파일명·revision만으로 저장됨을 표시하지 않고 실제 디스크 내용 일치를 확인한다", async () => {
  expect(labels().file).toBe("파일 저장 미확인");
  await start(); expect(labels().file).toBe("파일 저장됨");
  expect(labels().draftHelp).toContain("작업공간 파일에도");
  edit(); expect(labels().file).toBe("수정됨 · 파일 미저장");
  expect(labels().browser).toBe("현재 탭에만 보관");
  await vi.advanceTimersByTimeAsync(600);
  expect(labels().browser).toBe("브라우저 초안 보관됨");
  expect(labels().file).toBe("수정됨 · 파일 미저장");
});
it("저장 중 추가 편집은 성공한 요청의 내용으로 오인하지 않는다", async () => {
  await start(); edit("저장할 내용");
  let finish!: () => void;
  vi.mocked(writeWorkspaceFile).mockImplementationOnce((path, text) => new Promise(resolve => {
    finish = () => { disk = { text: text as string, revision: "rev-2" }; resolve({ ok: true, path, revision: "rev-2" }); };
  }));
  const saving = saveSpec(useEditorStore.getState().spec);
  await vi.advanceTimersByTimeAsync(0);
  expect(labels().file).toBe("파일 저장 중");
  edit("요청 이후 편집"); finish(); await saving;
  await vi.advanceTimersByTimeAsync(1);
  expect(labels().file).toBe("수정됨 · 파일 미저장");
  await saveSpec(useEditorStore.getState().spec);
  // fixture의 revision도 실제 내용처럼 매번 바꾼다.
  disk.revision = "rev-3";
  await vi.advanceTimersByTimeAsync(3000);
  expect(labels().file).toBe("파일 저장됨");
});
it("실패는 저장됨이 아니며 Save as 취소는 기존 상태와 내용을 유지한다", async () => {
  await start(); edit();
  vi.mocked(writeWorkspaceFile).mockResolvedValueOnce({ ok: false, error: "disk full", status: 507 });
  await saveSpec(useEditorStore.getState().spec);
  expect(labels().file).toBe("파일 저장 실패");
  const before = labels(); const spec = useEditorStore.getState().spec;
  const pending = saveSpecAs(spec);
  await vi.advanceTimersByTimeAsync(0);
  usePromptDialogStore.getState().resolve(null); await pending;
  expect(labels()).toEqual(before); expect(useEditorStore.getState().spec).toBe(spec);
});
it("다운로드 fallback은 실제 파일 저장 성공으로 표시하지 않는다", async () => {
  await start(); edit();
  vi.mocked(isWorkspaceAvailable).mockResolvedValue(false);
  vi.stubGlobal("document", { createElement: () => ({ click: vi.fn() }) });
  vi.stubGlobal("URL", { createObjectURL: () => "blob:fixture", revokeObjectURL: vi.fn() });
  await saveSpec(useEditorStore.getState().spec);
  expect(labels().file).toBe("다운로드 요청됨");
  edit("다운로드 이후"); expect(labels().file).not.toBe("파일 저장됨");
});
it("오래된 Save 응답은 교체된 문서의 상태를 바꾸지 않는다", async () => {
  await start(); edit(); let finish!: () => void;
  vi.mocked(writeWorkspaceFile).mockImplementationOnce(path => new Promise(resolve => { finish = () => resolve({ ok: true, path, revision: "late" }); }));
  const saving = saveSpec(useEditorStore.getState().spec); await vi.advanceTimersByTimeAsync(0);
  useEditorStore.getState().loadSpec({ ...initial, name: "다른 문서" });
  useDocumentStore.getState().clearFileName();
  finish(); await saving;
  expect(labels().file).toBe("파일 미저장");
});
it("오래된 디스크 읽기와 새로고침 복구의 파일명을 저장 근거로 쓰지 않는다", async () => {
  let finish!: (snapshot: typeof disk) => void;
  vi.mocked(readWorkspaceSpecSnapshot).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  stops.push(startDiskWatch()); await vi.advanceTimersByTimeAsync(3000);
  const old = disk;
  useEditorStore.getState().loadSpec({ ...initial, name: "다른 내용" });
  useDocumentStore.getState().setFileName("another.json", "rev-other");
  finish(old); await vi.advanceTimersByTimeAsync(1);
  expect(labels().file).not.toBe("파일 저장됨");
});
it("디스크 확인 실패는 과거의 저장됨 표시를 무효화한다", async () => {
  await start(); expect(labels().file).toBe("파일 저장됨");
  vi.mocked(readWorkspaceSpecSnapshot).mockResolvedValue(null);
  await vi.advanceTimersByTimeAsync(3000); expect(labels().file).toBe("파일 저장 미확인");
});
it("외부 변경을 유지하거나 충돌 중이면 저장됨보다 그 상태를 우선한다", async () => {
  await start(); edit(); disk = { text: JSON.stringify({ ...initial, name: "외부 내용" }), revision: "external" };
  await vi.advanceTimersByTimeAsync(3000); expect(labels().file).toBe("외부 파일 변경");
  useSaveConflictStore.getState().pause(true); expect(labels().file).toBe("충돌 · 저장 중단");
  await useSaveConflictStore.getState().loadLatest();
  await vi.advanceTimersByTimeAsync(3000); expect(labels().file).toBe("파일 저장됨");
});
it("다른 탭 초안 충돌과 복원은 파일 저장과 구분한다", async () => {
  await start(); edit();
  const key = projectStorageKey("saved.json", "");
  localStorage.setItem(key, serializeStoredDocument({ fileName: "saved.json", diskRevision: "rev-1", spec: { ...initial, name: "다른 탭 초안" } }));
  events.get("storage")?.({ key, storageArea: localStorage });
  expect(labels().file).toBe("충돌 · 저장 중단");
  await useSaveConflictStore.getState().loadLatest(); await vi.advanceTimersByTimeAsync(3000);
  expect(labels().file).toBe("수정됨 · 파일 미저장"); expect(labels().browser).toBe("브라우저 초안 보관됨");
});
it("무제 초안의 보관과 복구는 파일 저장을 뜻하지 않는다", async () => {
  useDocumentStore.getState().clearFileName(); await start(); edit(); await vi.advanceTimersByTimeAsync(600);
  expect(labels().file).toBe("파일 미저장"); expect(labels().browser).toBe("브라우저 초안 보관됨");
  const recovery = readRecovery()!; stops.reverse().forEach(stop => stop()); stops = [];
  useEditorStore.getState().loadSpec(recovery.document.spec); writeRecovery(recovery);
  await start(); expect(labels().file).toBe("파일 미저장"); expect(labels().browser).toBe("브라우저 초안 보관됨");
});
it("소유권이 없으면 동일한 보관본이 있어도 다른 탭 사용 중으로 표시한다", async () => {
  useDocumentStore.getState().clearFileName();
  vi.stubGlobal("navigator", { locks: { request: async (_key: string, _options: unknown, callback: (lock: null) => unknown) => callback(null) } });
  await start(); expect(labels().browser).toBe("다른 탭 사용 중"); expect(labels().file).toBe("파일 미저장");
});
it("공유·탭 저장소 실패는 보관됐다고 표시하지 않는다", async () => {
  useDocumentStore.getState().clearFileName();
  await start();
  localStorage.setItem = () => { throw new Error("quota"); };
  sessionStorage.setItem = () => { throw new Error("denied"); };
  edit(); await vi.advanceTimersByTimeAsync(600);
  expect(labels().browser).toBe("초안 보관 실패"); expect(labels().file).toBe("파일 미저장");
});

it("잠금 API 오류를 다른 탭 소유권이라고 단정하지 않는다", async () => {
  useDocumentStore.getState().clearFileName();
  vi.stubGlobal("navigator", { locks: { request: async () => { throw new Error("permission"); } } });
  await start(); edit(); await vi.advanceTimersByTimeAsync(600);
  expect(labels().browser).toBe("현재 탭에만 보관");
});

// 실제 watcher에서 같은 외부 revision의 알림 억제와 관측 회복을 별도로 검증한다.
it.each([false, true])("같은 외부 revision의 GET 회복과 Home/Resume은 중복 알림 없이 상태를 복원한다 (유지=%s)", async keep => {
  await start(); edit("내 미저장 편집");
  const local = useEditorStore.getState().spec;
  const documentId = useEditorStore.getState().documentId;
  disk = { text: JSON.stringify({ ...initial, name: "외부 r2" }), revision: "rev-2" };
  await vi.advanceTimersByTimeAsync(3000);
  const notice = useAgentEditStore.getState().diskNotice;
  expect(notice?.kind).toBe("diskChanged");
  if (keep) useAgentEditStore.getState().resolveDiskChange(false);
  const expectedNotice = keep ? null : notice;
  const noticeChanges = vi.fn();
  const unsubscribe = useAgentEditStore.subscribe((next, prev) => { if (next.diskNotice !== prev.diskNotice) noticeChanges(); });
  try {
    vi.mocked(readWorkspaceSpecSnapshot).mockResolvedValueOnce(null);
    await vi.advanceTimersByTimeAsync(3000);
    expect(labels().file).toBe("파일 저장 미확인");
    await vi.advanceTimersByTimeAsync(9000);
    expect(labels().file).toBe("외부 파일 변경");
    expect(useAgentEditStore.getState().diskNotice).toBe(expectedNotice);
    expect(noticeChanges).not.toHaveBeenCalled();
    // Home은 열린 알림만 지운다. 유지한 revision은 Resume에서도 다시 묻지 않는다.
    useNavigationStore.getState().openHome();
    expect(labels().file).toBe("파일 저장 미확인");
    noticeChanges.mockClear();
    useNavigationStore.getState().openEditor();
    await vi.advanceTimersByTimeAsync(9000);
    expect(labels().file).toBe("외부 파일 변경");
    expect(noticeChanges).toHaveBeenCalledTimes(keep ? 0 : 1);
    expect(useEditorStore.getState().spec).toBe(local);
    expect(useEditorStore.getState().documentId).toBe(documentId);
    expect(useDocumentStore.getState().diskRevision).toBe("rev-1");
  } finally { unsubscribe(); }
});

it("늦은 r1 baseline은 이미 관측하고 유지한 r2를 저장됨으로 덮지 않는다", async () => {
  await start();
  let finish!: (snapshot: typeof disk) => void;
  const r1 = disk;
  vi.mocked(readWorkspaceSpecSnapshot).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  useEditorStore.getState().loadSpec(structuredClone(initial)); // 같은 r1 내용을 새 문서로 열어 baseline 읽기를 시작
  disk = { text: JSON.stringify({ ...initial, name: "새 외부 r2" }), revision: "rev-2" };
  await vi.advanceTimersByTimeAsync(3000);
  expect(useAgentEditStore.getState().diskNotice?.kind).toBe("diskChanged");
  useAgentEditStore.getState().resolveDiskChange(false);
  expect(labels().file).toBe("외부 파일 변경");
  const observed = usePersistenceStatusStore.getState().disk;
  const changes = vi.fn();
  const unsubscribe = usePersistenceStatusStore.subscribe(changes);
  try {
    finish(r1); await vi.advanceTimersByTimeAsync(0);
    expect(usePersistenceStatusStore.getState().disk).toBe(observed);
    expect(changes).not.toHaveBeenCalled(); // 일시적인 false-saved도 허용하지 않음
    expect(labels().file).toBe("외부 파일 변경");
    await vi.advanceTimersByTimeAsync(9000);
    expect(labels().file).toBe("외부 파일 변경");
    expect(useAgentEditStore.getState().diskNotice).toBeNull();
    expect(useDocumentStore.getState().diskRevision).toBe("rev-1");
    useNavigationStore.getState().openHome();
    useNavigationStore.getState().openEditor();
    await vi.advanceTimersByTimeAsync(9000);
    expect(labels().file).toBe("외부 파일 변경");
    expect(useAgentEditStore.getState().diskNotice).toBeNull();
  } finally { unsubscribe(); }
});

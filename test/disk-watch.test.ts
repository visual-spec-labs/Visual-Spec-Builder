import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { migrateV01, type ProjectSpec } from "@/features/editor/schema";
import { useAgentEditStore } from "@/features/editor/store/agentEditStore";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { seedSpec } from "@/features/editor/store/seedSpec";
import { startDiskWatch } from "@/features/editor/ui/diskWatch";
import { readWorkspaceSpecSnapshot } from "@/features/editor/ui/workspaceClient";

/**
 * 열린 파일의 디스크 변경 감지(#279 2/2). 디스크 읽기만 흉내 내고, 스토어·Undo는 실제 코드를 쓴다.
 */
vi.mock("@/features/editor/ui/workspaceClient", () => ({
  isWorkspaceAvailable: vi.fn(async () => true),
  readWorkspaceSpecSnapshot: vi.fn(),
}));

const base: ProjectSpec = migrateV01(seedSpec);
const withTitle = (content: string): ProjectSpec => structuredClone({
  ...base, pages: { ...base.pages, page1: { ...base.pages.page1, nodes: {
    ...base.pages.page1.nodes, headerTitle: { ...base.pages.page1.nodes.headerTitle, content } as never } } },
});
const title = () => (useEditorStore.getState().spec.pages.page1.nodes.headerTitle as { content: string }).content;
let disk: { text: string; revision: string };
const setDisk = (spec: ProjectSpec, revision: string) => { disk = { text: JSON.stringify(spec), revision }; };

let stop: (() => void) | undefined;
/** 앱 순서대로 감시를 먼저 시작하고 파일을 연다 — 여는 순간이 디스크와 맞춘 기준이 된다. */
async function watch({ openFile = true } = {}) {
  stop = startDiskWatch();
  if (openFile) {
    useDocumentStore.getState().clearFileName();
    useDocumentStore.getState().setFileName("same.json", "rev-1");
  }
  await vi.advanceTimersByTimeAsync(10);
}
const tick = () => vi.advanceTimersByTimeAsync(3000);

beforeEach(() => {
  vi.useFakeTimers();
  useEditorStore.getState().loadSpec(structuredClone(base));
  useDocumentStore.getState().setFileName("same.json", "rev-1");
  useNavigationStore.getState().openEditor();
  useSaveConflictStore.setState({ paused: false });
  useAgentEditStore.setState({ notice: null });
  setDisk(base, "rev-1");
  vi.mocked(readWorkspaceSpecSnapshot).mockImplementation(async () => disk);
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.clearAllMocks(); });

describe("열린 파일의 디스크 변경 (#279)", () => {
  it("미저장 편집이 없으면 디스크 내용을 Undo 한 단계로 불러오고 알린다", async () => {
    await watch();
    const before = title();
    setDisk(withTitle("에이전트가 파일에서 고침"), "rev-2");
    await tick();

    expect(title()).toBe("에이전트가 파일에서 고침");
    expect(useDocumentStore.getState().diskRevision).toBe("rev-2");
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "diskImported", fileName: "same.json" });
    useEditorStore.getState().undo();
    expect(title()).toBe(before);
  });

  it("디스크 내용이 지금 화면과 같으면(방금 저장) 버전만 조용히 맞춘다", async () => {
    await watch();
    const history = useEditorStore.getState().history;
    setDisk(base, "rev-saved");
    await tick();
    expect(useDocumentStore.getState().diskRevision).toBe("rev-saved");
    expect(useEditorStore.getState().history).toBe(history);
    expect(useAgentEditStore.getState().notice).toBeNull();
  });

  it("미저장 편집이 있으면 묻고, 불러오기를 고르면 Undo로 내 편집에 돌아올 수 있다", async () => {
    await watch();
    useEditorStore.getState().setNodeField("headerTitle", "content", "내 미저장 편집");
    setDisk(withTitle("디스크 변경"), "rev-2");
    await tick();
    expect(title()).toBe("내 미저장 편집");
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "diskChanged", revision: "rev-2" });

    useAgentEditStore.getState().resolveDiskChange(true);
    expect(title()).toBe("디스크 변경");
    expect(useDocumentStore.getState().diskRevision).toBe("rev-2");
    useEditorStore.getState().undo();
    expect(title()).toBe("내 미저장 편집");
  });

  it("내 편집을 유지하면 같은 버전은 다시 묻지 않고, 더 새로운 버전은 다시 묻는다", async () => {
    await watch();
    useEditorStore.getState().setNodeField("headerTitle", "content", "내 편집");
    setDisk(withTitle("디스크 변경 1"), "rev-2");
    await tick();
    useAgentEditStore.getState().resolveDiskChange(false);
    expect(title()).toBe("내 편집");
    expect(useDocumentStore.getState().diskRevision).toBe("rev-1"); // 다음 저장은 디스크 충돌로 확인된다

    await tick();
    expect(useAgentEditStore.getState().notice).toBeNull();
    setDisk(withTitle("디스크 변경 2"), "rev-3");
    await tick();
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "diskChanged", revision: "rev-3" });
  });

  it("검증에 실패하는 새 내용은 불러오지 않고 한 번만 알린다", async () => {
    await watch();
    disk = { text: JSON.stringify({ version: "0.3", pages: {} }), revision: "rev-bad" };
    await tick();
    expect(title()).toBe((base.pages.page1.nodes.headerTitle as { content: string }).content);
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "diskInvalid" });
    useAgentEditStore.setState({ notice: null });
    await tick();
    expect(useAgentEditStore.getState().notice).toBeNull();
  });

  it("저장하면 기준이 옮겨져, 그 뒤 디스크 변경은 미저장 편집 없이 불러온다", async () => {
    await watch();
    useEditorStore.getState().setNodeField("headerTitle", "content", "저장할 편집");
    useDocumentStore.getState().setFileName("same.json", "rev-saved"); // Save가 하는 일
    setDisk(withTitle("저장 뒤 디스크 변경"), "rev-4");
    await tick();
    expect(title()).toBe("저장 뒤 디스크 변경");
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "diskImported" });
  });

  it("홈 화면·제목 없는 문서·저장 충돌 중에는 확인하지 않는다", async () => {
    await watch();
    setDisk(withTitle("바뀜"), "rev-2");
    useNavigationStore.getState().openHome();
    await tick();
    useNavigationStore.getState().openEditor();
    useSaveConflictStore.setState({ paused: true });
    await tick();
    useSaveConflictStore.setState({ paused: false });
    useDocumentStore.getState().clearFileName();
    await tick();
    expect(readWorkspaceSpecSnapshot).not.toHaveBeenCalled();
  });

  it("시작 시점(새로고침으로 복원한 문서)은 디스크와 맞는지 모르므로 묻고, 열기·저장 뒤부터 바로 불러온다", async () => {
    useEditorStore.getState().setNodeField("headerTitle", "content", "탭 복구로 되살린 미저장 편집");
    await watch({ openFile: false }); // 감시 시작 — 그 전의 편집은 열기·저장으로 맞춘 적이 없다
    setDisk(withTitle("디스크 변경"), "rev-2");
    await tick();
    expect(title()).toBe("탭 복구로 되살린 미저장 편집");
    expect(useAgentEditStore.getState().notice).toMatchObject({ kind: "diskChanged" });
  });
});


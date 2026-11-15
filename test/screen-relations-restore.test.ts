import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fixture from "./fixtures/screen-relations-project.json";
import { runTransactionGates } from "@/features/editor/command/transactionGate";
import { validateProjectSpec, type ProjectSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { buildExportPayload } from "@/features/editor/store/exportSpec";
import { parseSpecJson } from "@/features/editor/store/loadSpec";
import { seedSpec } from "@/features/editor/store/seedSpec";
import {
  loadStoredFileName,
  loadStoredSpec,
  readRecovery,
  RECOVERY_KEY,
  saveSpecToStorage,
  serializeStoredDocument,
  writeRecovery,
} from "@/features/editor/store/specStorage";
import { listUnnamedDrafts, UNNAMED_DRAFT_PREFIX } from "@/features/editor/store/unnamedDraftStore";

/**
 * 화면 관계 오류가 생긴 문서의 복원·저장 경계(#265 S1-2).
 *
 * S1-4 이전 GUI 페이지 삭제(removePage)는 그 페이지를 가리키는 action을 정리하지 못했고
 * 첫 page를 다시 고르지도 않았다. 지금 검사는 당시 저장본을 직접 구성한다. 그 상태가 자동 저장된 뒤 새로고침 한 번에 작업이 seedSpec으로
 * 바뀌지 않도록 자동 저장 복원은 관계 오류만 남은 문서를 받는다. Open·Save·NL G3는 엄격하다.
 */
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  } as Storage;
}

function project(): ProjectSpec {
  return structuredClone(fixture) as unknown as ProjectSpec;
}

/** S1-4 이전에 저장된 무효 프로젝트: 새 GUI의 안전한 삭제로 재현하지 않는다. */
function afterRemovingPages(...pageIds: string[]): ProjectSpec {
  const legacy = project();
  for (const id of pageIds) delete legacy.pages[id];
  legacy.pageOrder = legacy.pageOrder.filter((id) => !pageIds.includes(id)) as ProjectSpec["pageOrder"];
  useEditorStore.getState().loadSpec(legacy);
  return useEditorStore.getState().spec;
}

/** 자동 저장을 한 뒤 새로고침한 것처럼 editorStore 모듈을 새로 읽어 초기 문서를 돌려준다. */
async function reloadEditor(): Promise<ProjectSpec> {
  vi.resetModules();
  const fresh = await import("@/features/editor/store/editorStore");
  expect(fresh.useEditorStore.getState().history.past).toEqual([]);
  const beforeUndo = fresh.useEditorStore.getState().spec;
  fresh.useEditorStore.getState().undo();
  expect(fresh.useEditorStore.getState().spec).toBe(beforeUndo);
  return fresh.useEditorStore.getState().spec;
}

const DANGLING = { code: "action-target-missing", path: "/pages/login/nodes/loginButton/action/target" };
const MODAL_FIRST = { code: "first-page-kind", path: "/pageOrder/0" };

describe("관계 오류가 생긴 문서의 자동 저장 복원 (#265 S1-2)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["navigate 대상 페이지 삭제", ["dashboard"], [DANGLING]],
    ["첫 page들 삭제로 modal이 첫 화면", ["login", "dashboard"], [MODAL_FIRST]],
  ])("%s 뒤 새로고침해도 문서가 그대로 돌아오고 seedSpec으로 바뀌지 않는다", async (_label, removed, expected) => {
    const spec = afterRemovingPages(...removed);
    expect(validateProjectSpec(spec).issues.map(({ code, path }) => ({ code, path }))).toEqual(expected);

    saveSpecToStorage(spec, "login-flow.json");
    expect(loadStoredSpec()).toEqual(spec);
    expect(loadStoredFileName()).toBe("login-flow.json");

    const restored = await reloadEditor();
    expect(restored).toEqual(spec);
    expect(JSON.stringify(restored)).not.toBe(JSON.stringify(seedSpec));
  });

  it("탭 복구(sessionStorage)도 같은 문서를 돌려준다", () => {
    const spec = afterRemovingPages("dashboard");
    const document = { fileName: null, spec };
    expect(writeRecovery({ document, key: `${UNNAMED_DRAFT_PREFIX}tab`, baseline: null, conflicted: false })).toBe(true);
    expect(readRecovery()?.document.spec).toEqual(spec);
    expect(sessionStorage.getItem(RECOVERY_KEY)).not.toBeNull();
  });

  it.each([
    ["navigate 대상 페이지 삭제", ["dashboard"]],
    ["첫 page들 삭제로 modal이 첫 화면", ["login", "dashboard"]],
  ])("%s 뒤의 이름 없는 초안이 목록에 계속 보인다", (_label, removed) => {
    const spec = afterRemovingPages(...removed);
    const key = `${UNNAMED_DRAFT_PREFIX}relations`;
    localStorage.setItem(key, serializeStoredDocument({ fileName: null, spec }));
    expect(listUnnamedDrafts().map((draft) => [draft.key, draft.document.spec])).toEqual([[key, spec]]);
  });

  it.each([
    ["root 없음", (spec: ProjectSpec) => { spec.pages.login.root = "ghost"; }],
    ["스키마 위반", (spec: ProjectSpec) => { (spec.pages.login as unknown as Record<string, unknown>).extra = 1; }],
  ])("관계 오류에 구조 오류(%s)가 섞이면 전처럼 버린다", (_label, breakIt) => {
    const spec = structuredClone(afterRemovingPages("dashboard"));
    breakIt(spec);
    saveSpecToStorage(spec, null);
    expect(loadStoredSpec()).toBeUndefined();
    localStorage.setItem(`${UNNAMED_DRAFT_PREFIX}broken`, serializeStoredDocument({ fileName: null, spec }));
    expect(listUnnamedDrafts()).toEqual([]);
  });
});

describe("관계 오류가 생긴 문서의 엄격한 경로 (#265 S1-2)", () => {
  it.each([
    ["navigate 대상 페이지 삭제", ["dashboard"], [DANGLING]],
    ["첫 page들 삭제로 modal이 첫 화면", ["login", "dashboard"], [MODAL_FIRST]],
  ])("%s 뒤 Save는 ok:false와 이슈를 돌려준다", (_label, removed, expected) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = buildExportPayload(afterRemovingPages(...removed));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issueCount).toBe(expected.length);
    expect(result.issues.map(({ code, path }) => ({ code, path }))).toEqual(expected);
    warn.mockRestore();
  });

  it("Open은 관계 오류가 있는 파일을 거부한다(파일 자체는 건드리지 않는다)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseSpecJson(JSON.stringify(afterRemovingPages("dashboard")))).toMatchObject({ ok: false, issueCount: 1, issues: [DANGLING] });
    warn.mockRestore();
  });

  it("Undo 한 번이면 지운 대상 페이지와 함께 유효한 문서로 돌아오고 Save가 다시 된다", () => {
    useEditorStore.getState().loadSpec(project());
    useEditorStore.getState().removePage("dashboard");
    useEditorStore.getState().undo();
    const spec = useEditorStore.getState().spec;
    expect({ ...spec, projectId: undefined }).toEqual(project());
    expect(buildExportPayload(spec).ok).toBe(true);
  });

  // 과거 무효 복구본의 엄격한 G3 경계: 관계 오류가 남은 동안 NL G3는 관계와 무관한 편집도 거부한다.
  // 복원 후에는 이전 Undo 기록이 없고 first-page-kind는 버튼 삭제로 해결되지 않는다.
  it("관계 오류가 남은 문서에서는 NL G3가 다른 페이지의 무관한 편집도 거부한다", () => {
    const spec = afterRemovingPages("dashboard");
    const result = runTransactionGates(spec, "resetPassword", [
      { type: "updateNode", id: "title", path: "content", value: "새 제목" },
    ]);
    expect(result).toMatchObject({ ok: false, failure: { kind: "invalid", issues: [DANGLING] } });
  });
});


describe("관계 오류 안내와 저장 실패의 보존 계약", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("first-page-kind는 남은 버튼을 모두 삭제해도 해결되지 않는다", () => {
    afterRemovingPages("login", "dashboard");
    for (const pageId of useEditorStore.getState().spec.pageOrder) {
      useEditorStore.getState().selectPage(pageId);
      for (const [nodeId, node] of Object.entries(useEditorStore.getState().spec.pages[pageId].nodes)) {
        if (node.type === "button") useEditorStore.getState().removeNode(nodeId);
      }
    }
    expect(validateProjectSpec(useEditorStore.getState().spec).issues).toMatchObject([MODAL_FIRST]);
  });

  it("안내는 모든 오류의 코드·경로·원인과 복구 한계를 담는다", async () => {
    const { formatValidationIssues, validationFailureMessage } = await import("@/features/editor/store/validationGuidance");
    const issues = validateProjectSpec(afterRemovingPages("dashboard")).issues;
    expect(formatValidationIssues(issues)).toContain(`[${DANGLING.code}] ${DANGLING.path}: ${issues[0].message}`);
    const save = validationFailureMessage("저장할 수 없습니다", issues, "save");
    expect(save).toContain("이전 Undo 기록을 복원하지 않습니다");
    expect(save).toContain("first-page-kind는 해결하지 못합니다");
    expect(save).toContain("미검증 복구 사본");
    expect(save).toContain("기존 파일과 다른 이름으로 작업공간 .visual-spec/specs/에 넣은 뒤");
    expect(save).toContain("파일 → 열기 목록에서 그 사본을 선택");
    expect(save).toContain("작업공간이 없으면 파일 → 열기에서 수정 사본을 직접 선택");
    expect(validationFailureMessage("열 수 없습니다", issues, "open")).toContain("선택한 원본 파일과 현재 작업은 변경하지 않았습니다");
  });

  it.each(["saveSpec", "saveSpecAs"] as const)("%s 실패는 쓰기·다운로드·파일명 변경 없이 작업과 초안을 유지한다", async (method) => {
    // resetModules를 쓴 복원 검사와 같은 최신 모듈 인스턴스로 비교한다.
    const { useEditorStore: editor } = await import("@/features/editor/store/editorStore");
    const { useDocumentStore: document } = await import("@/features/editor/store/documentStore");
    const { useSaveConflictStore: conflict } = await import("@/features/editor/store/saveConflictStore");
    const { usePersistenceStatusStore: persistence } = await import("@/features/editor/store/persistenceStatusStore");
    const exports = await import("@/features/editor/ui/exportSpecAsJson");
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
    const alert = vi.fn(); const fetch = vi.fn();
    vi.stubGlobal("window", { alert }); vi.stubGlobal("fetch", fetch);
    vi.spyOn(conflict.getState(), "check").mockReturnValue(false);
    conflict.setState({ paused: false });
    editor.getState().loadSpec(project());
    document.getState().setFileName("original.json", "original-revision");
    const legacy = project();
    delete legacy.pages.dashboard;
    legacy.pageOrder = legacy.pageOrder.filter((id) => id !== "dashboard") as ProjectSpec["pageOrder"];
    editor.getState().loadSpec(legacy);
    const spec = editor.getState().spec;
    saveSpecToStorage(spec, "original.json");
    const raw = localStorage.getItem("visual-spec:project");
    const history = editor.getState().history;
    const result = await exports[method](spec);
    expect(result).toMatchObject({ ok: false, issues: [DANGLING] });
    expect(alert).toHaveBeenCalledWith(expect.stringContaining(DANGLING.path));
    expect(fetch).not.toHaveBeenCalled();
    expect(editor.getState().spec).toBe(spec);
    expect(editor.getState().history).toBe(history);
    expect(document.getState().fileName).toBe("original.json");
    expect(document.getState().diskRevision).toBe("original-revision");
    expect(localStorage.getItem("visual-spec:project")).toBe(raw);
    expect(persistence.getState().attempt?.phase).toBe("failed");
  });
});

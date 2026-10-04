import { createServer, type Server } from "node:http";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { migrateV01 } from "@/features/editor/schema";
import type { ProjectSpec, VisualSpec } from "@/features/editor/schema";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { saveSpecToStorage } from "@/features/editor/store/specStorage";
import { exportSpecAsJson, saveSpec, saveSpecAs } from "@/features/editor/ui/exportSpecAsJson";
import { newSpec } from "@/features/editor/ui/newSpec";
import { openSpec } from "@/features/editor/ui/openSpecFromFile";
import {
  createWorkspaceMiddleware,
  ensureWorkspaceDirs,
} from "@/features/workspace/workspaceServer";

import dashboardCards from "../examples/dashboard-cards.json";

/**
 * **Open/Save as로 정한 파일에 Save가 그대로 쓰는가** (PR #145 리뷰, wook3964).
 *
 * 리뷰가 든 재현 절차를 그대로 따라간다 — `customer-copy.json`(내부 `spec.name`은
 * `"Dashboard"`)을 열고, 고치고, Save한다. 고친 내용이 **그 파일에** 들어가고
 * `Dashboard.json`이 새로 생기지 않아야 한다.
 *
 * **가짜 클라이언트를 만들지 않는다.** Open도 Save도 진짜 미들웨어를 거쳐 진짜 파일을
 * 만지게 두고, 브라우저에만 있는 것 셋(`window.prompt`·`window.alert`, 그리고 상대
 * 경로를 받는 `fetch`)만 최소한으로 대신한다. 결함이 "파일이 하나 더 생긴다"는
 * 모양이라 스토어 상태만 봐서는 증명이 안 되고 디스크를 봐야 한다.
 */

let server: Server;
let baseUrl: string;
let workspaceRoot: string;
let handler: ReturnType<typeof createWorkspaceMiddleware>;

const alerts: string[] = [];
let promptAnswer: string | null = null;

const realFetch = globalThis.fetch;

/** 예제 스펙을 프로젝트로 올린 것. 파일 이름과 `spec.name`을 일부러 어긋나게 쓴다. */
function dashboardSpec(): ProjectSpec {
  return { ...migrateV01(dashboardCards as VisualSpec), name: "Dashboard" };
}

function specsDir(): string[] {
  return readdirSync(join(workspaceRoot, "specs")).sort((a, b) => a.localeCompare(b));
}

function readSpecFile(name: string): ProjectSpec {
  return JSON.parse(readFileSync(join(workspaceRoot, "specs", name), "utf8")) as ProjectSpec;
}

/**
 * localStorage 최소 구현(이슈 #185) — `test/spec-storage.test.ts`와 같은 이유로 이
 * 파일도 직접 흉내 낸다(vitest environment가 "node"라 이 API 자체가 없다).
 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

/** 지금 열린 문서의 활성 페이지 이름을 바꾼다 — "열어서 고쳤다"를 흉내 내는 편집. */
function renameActivePage(to: string): string {
  const { activePageId, setPageField } = useEditorStore.getState();
  setPageField(activePageId, "name", to);
  return activePageId;
}

async function save(): Promise<void> {
  await saveSpec(useEditorStore.getState().spec);
}

beforeAll(async () => {
  server = createServer((req, res) => {
    handler(req, res, () => {
      res.statusCode = 404;
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  vi.stubGlobal("window", {
    alert: (message: string) => alerts.push(message),
    prompt: () => promptAnswer,
  });
  // 클라이언트는 `/__vs/...` 상대 경로로 부른다 — 브라우저에서는 문서 오리진이
  // 붙지만 node에는 그게 없다. 오리진만 붙여 진짜 서버로 보낸다.
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    realFetch(new URL(String(input), baseUrl), init),
  );
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

beforeEach(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "visual-spec-doc-"));
  ensureWorkspaceDirs(workspaceRoot);
  handler = createWorkspaceMiddleware(workspaceRoot);
  alerts.length = 0;
  promptAnswer = null;
  useDocumentStore.getState().clearFileName();
});

afterEach(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

describe("Open 다음의 Save는 연 그 파일에 쓴다 (PR #145 리뷰)", () => {
  beforeEach(() => {
    writeFileSync(
      join(workspaceRoot, "specs", "customer-copy.json"),
      JSON.stringify(dashboardSpec(), null, 2),
    );
  });

  it("customer-copy.json(내부 이름은 Dashboard)을 열어 고치고 Save하면 그 파일이 갱신된다", async () => {
    promptAnswer = "customer-copy.json";
    await openSpec();

    expect(useEditorStore.getState().spec.name).toBe("Dashboard");

    const pageId = renameActivePage("고친 페이지");
    await save();

    expect(readSpecFile("customer-copy.json").pages[pageId].name).toBe("고친 페이지");
  });

  it("Dashboard.json 같은 새 파일이 생기지 않는다 — 결함의 알맹이가 이것이다", async () => {
    promptAnswer = "customer-copy.json";
    await openSpec();
    renameActivePage("고친 페이지");
    await save();

    expect(specsDir()).toEqual(["customer-copy.json"]);
    expect(existsSync(join(workspaceRoot, "specs", "Dashboard.json"))).toBe(false);
  });

  it("Save를 두 번 해도 같은 파일에 쓴다", async () => {
    promptAnswer = "customer-copy.json";
    await openSpec();
    renameActivePage("첫 번째");
    await save();
    const pageId = renameActivePage("두 번째");
    await save();

    expect(specsDir()).toEqual(["customer-copy.json"]);
    expect(readSpecFile("customer-copy.json").pages[pageId].name).toBe("두 번째");
  });

  it("번호로 골라 열어도 이름을 기억한다 — 목록의 1번이든 이름이든 같다", async () => {
    promptAnswer = "1";
    await openSpec();

    expect(useDocumentStore.getState().fileName).toBe("customer-copy.json");
  });

  it("고르기를 취소하면 현재 문서가 바뀌지 않는다", async () => {
    useDocumentStore.getState().setFileName("before.json");
    promptAnswer = null;
    await openSpec();

    expect(useDocumentStore.getState().fileName).toBe("before.json");
  });

  it("검증에 실패한 파일은 현재 문서가 되지 않는다 — 안 열린 파일을 Save가 덮어쓰면 안 된다", async () => {
    writeFileSync(join(workspaceRoot, "specs", "broken.json"), "{ 이건 JSON이 아니다");
    useDocumentStore.getState().setFileName("customer-copy.json");
    promptAnswer = "broken.json";
    await openSpec();

    expect(useDocumentStore.getState().fileName).toBe("customer-copy.json");
    expect(alerts.join("\n")).toContain("broken.json");
  });
});

describe("Save as 다음의 Save도 그 파일에 쓴다 (PR #145 리뷰)", () => {
  it("Save as로 만든 foo.json을 이어서 Save가 갱신한다", async () => {
    newSpec();
    promptAnswer = "foo";
    await saveSpecAs(useEditorStore.getState().spec);

    expect(existsSync(join(workspaceRoot, "specs", "foo.json"))).toBe(true);

    const pageId = renameActivePage("Save as 뒤의 편집");
    await save();

    expect(specsDir()).toEqual(["foo.json"]);
    expect(readSpecFile("foo.json").pages[pageId].name).toBe("Save as 뒤의 편집");
  });

  it("Save as 기본값은 현재 문서 이름이다 — spec.name이 아니다", async () => {
    let shown: string | undefined;
    vi.stubGlobal("window", {
      alert: (message: string) => alerts.push(message),
      prompt: (_label: string, initial: string) => {
        shown = initial;
        return promptAnswer;
      },
    });
    useEditorStore.getState().loadSpec(dashboardSpec());
    useDocumentStore.getState().setFileName("customer-copy.json");
    promptAnswer = "customer-copy-2";

    await saveSpecAs(useEditorStore.getState().spec);

    expect(shown).toBe("customer-copy.json");
    vi.stubGlobal("window", {
      alert: (message: string) => alerts.push(message),
      prompt: () => promptAnswer,
    });
  });

  it("Save as를 취소하면 아무것도 쓰지 않고 현재 문서도 그대로다", async () => {
    useDocumentStore.getState().setFileName("keep.json");
    promptAnswer = null;

    const result = await saveSpecAs(useEditorStore.getState().spec);

    expect(result).toBeNull();
    expect(useDocumentStore.getState().fileName).toBe("keep.json");
    expect(specsDir()).toEqual([]);
  });

  it("저장이 거부되면 현재 문서 이름을 바꾸지 않는다 — 써 본 적 없는 파일을 가리키게 된다", async () => {
    useDocumentStore.getState().setFileName("keep.json");
    // `:`는 미들웨어가 거부하는 글자다(workspacePath.ts) — 실패하는 저장을 만든다.
    promptAnswer = "a:b";

    await saveSpecAs(useEditorStore.getState().spec);

    expect(useDocumentStore.getState().fileName).toBe("keep.json");
    expect(alerts.join("\n")).toContain("저장할 수 없습니다");
  });
});

describe("New는 현재 문서를 비운다 (PR #145 리뷰)", () => {
  beforeEach(() => {
    writeFileSync(
      join(workspaceRoot, "specs", "customer-copy.json"),
      JSON.stringify(dashboardSpec(), null, 2),
    );
  });

  it("New 다음의 Save는 방금 열었던 파일을 덮어쓰지 않는다", async () => {
    promptAnswer = "customer-copy.json";
    await openSpec();

    newSpec();
    expect(useDocumentStore.getState().fileName).toBeNull();

    await save();

    // 새 문서는 자기 이름(spec.name)으로 저장되고, 열었던 파일은 손대지 않는다.
    const newName = `${useEditorStore.getState().spec.name}.json`;
    expect(newName).not.toBe("customer-copy.json");
    expect(existsSync(join(workspaceRoot, "specs", newName))).toBe(true);
    expect(readSpecFile("customer-copy.json").name).toBe("Dashboard");
  });

});

describe("한 번도 저장하지 않은 문서", () => {
  it("첫 Save는 spec.name으로 파일을 만들고, 그 파일이 다음 Save의 대상이 된다", async () => {
    newSpec();
    await save();
    const created = `${useEditorStore.getState().spec.name}.json`;

    const pageId = renameActivePage("두 번째 저장");
    await save();

    expect(specsDir()).toEqual([created]);
    expect(readSpecFile(created).pages[pageId].name).toBe("두 번째 저장");
  });
});

/**
 * 새로고침한 뒤에도 Save가 연 파일에 그대로 쓴다 (이슈 #185).
 *
 * `documentStore.fileName`은 zustand 메모리 상태라 새로고침하면 모듈이 다시
 * 평가되며 사라졌다 — spec **내용**은 `specStorage.ts`(#128)가 복원해 줘도 파일명만
 * 잃어, 위 "Open 다음의 Save" 블록이 고정한 계약이 새로고침이라는 경로로 다시
 * 깨졌다. `vi.resetModules()` + 동적 `import()`로 실제 새로고침(모듈 상태가 전부
 * 사라지고 다시 읽히는 것)을 흉내 낸다 — `documentStore.ts`를 다시 읽으면 그
 * 최상단의 `loadStoredFileName() ?? null`이 다시 평가된다.
 *
 * `editorStore.ts`는 다시 import하지 않는다 — spec 내용 복원은 #128이 이미
 * 증명했고, 이 이슈가 새로 건드리는 것은 `documentStore.fileName` 하나뿐이다.
 * `saveSpec`은 spec을 인자로 받으므로 기존(리셋 안 된) `useEditorStore`에서 읽은
 * 값을 그대로 넘기면 된다 — `saveSpec` 자체는 파일명을 결정하려고
 * `useDocumentStore`를 내부에서 읽으므로, **그 함수만은** 새로고침 뒤의 새
 * `documentStore` 인스턴스를 보도록 같이 다시 import해야 한다.
 */
describe("새로고침해도 Save는 연 파일에 쓴다 (이슈 #185)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  it("파일명이 새로고침 뒤에도 살아남는다", async () => {
    writeFileSync(
      join(workspaceRoot, "specs", "customer-copy.json"),
      JSON.stringify(dashboardSpec(), null, 2),
    );
    promptAnswer = "customer-copy.json";
    await openSpec();
    expect(useDocumentStore.getState().fileName).toBe("customer-copy.json");

    // "새로고침 전에 자동저장이 이미 한 번 돌았다"를 흉내 낸다 — App.tsx의
    // useSpecAutosave가 실제로 하는 일과 같다(effect 타이밍 자체는 이 저장소에
    // 훅 테스트 도구가 없어 다루지 않는다, 다른 파일들과 같은 한계).
    saveSpecToStorage(useEditorStore.getState().spec, useDocumentStore.getState().fileName);

    vi.resetModules();
    const { useDocumentStore: freshDocumentStore } = await import(
      "@/features/editor/store/documentStore"
    );

    expect(freshDocumentStore.getState().fileName).toBe("customer-copy.json");
  });

  it("새로고침 뒤 고쳐서 Save하면 그 파일이 갱신되고 새 파일이 생기지 않는다 — 재현 시나리오", async () => {
    writeFileSync(
      join(workspaceRoot, "specs", "customer-copy.json"),
      JSON.stringify(dashboardSpec(), null, 2),
    );
    promptAnswer = "customer-copy.json";
    await openSpec();
    saveSpecToStorage(useEditorStore.getState().spec, useDocumentStore.getState().fileName);

    vi.resetModules();
    const { saveSpec: freshSaveSpec } = await import("@/features/editor/ui/exportSpecAsJson");
    const { useDocumentStore: freshDocumentStore } = await import(
      "@/features/editor/store/documentStore"
    );
    expect(freshDocumentStore.getState().fileName).toBe("customer-copy.json");

    const pageId = renameActivePage("새로고침 뒤 편집");
    await freshSaveSpec(useEditorStore.getState().spec);

    expect(specsDir()).toEqual(["customer-copy.json"]);
    expect(existsSync(join(workspaceRoot, "specs", "Dashboard.json"))).toBe(false);
    expect(readSpecFile("customer-copy.json").pages[pageId].name).toBe("새로고침 뒤 편집");
  });

  it("한 번도 저장 안 한 세션은 새로고침해도 여전히 무명이다 — specs/에 아무것도 안 쌓인다", async () => {
    newSpec();
    expect(useDocumentStore.getState().fileName).toBeNull();
    saveSpecToStorage(useEditorStore.getState().spec, null);

    vi.resetModules();
    const { useDocumentStore: freshDocumentStore } = await import(
      "@/features/editor/store/documentStore"
    );

    expect(freshDocumentStore.getState().fileName).toBeNull();
    expect(specsDir()).toEqual([]);
  });
});

describe("documentStore", () => {
  it("처음엔 어느 파일도 아니다", () => {
    expect(useDocumentStore.getState().fileName).toBeNull();
  });

  it("이름을 적고 지운다", () => {
    useDocumentStore.getState().setFileName("home.json");
    expect(useDocumentStore.getState().fileName).toBe("home.json");

    useDocumentStore.getState().clearFileName();
    expect(useDocumentStore.getState().fileName).toBeNull();
  });
});


describe("JSON Export 검증 실패 알림 (#230)", () => {
  it("무효 상태를 내보내면 원인과 위치를 알리고 다운로드하지 않는다", () => {
    const project = structuredClone(dashboardSpec());
    const page = project.pages[project.pageOrder[0]];
    page.nodes[page.root].box.width = -1;
    const createObjectURL = vi.spyOn(URL, "createObjectURL");
    const result = exportSpecAsJson(project);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toContain(`검증 실패 ${result.issueCount}건`);
      for (const issue of result.issues.slice(0, 3)) {
        expect(alerts[0]).toContain(`${issue.path}: ${issue.message}`);
      }
      if (result.issueCount > 3) {
        expect(alerts[0]).toContain(`외 ${result.issueCount - 3}건`);
      }
    }
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(specsDir()).toEqual([]);
    createObjectURL.mockRestore();
  });

  it("유효한 스펙은 알림 없이 브라우저 다운로드하고 현재 문서명을 바꾸지 않는다", () => {
    useDocumentStore.getState().setFileName("original.json");
    const click = vi.fn();
    const anchor = { href: "", download: "", click };
    vi.stubGlobal("document", { createElement: () => anchor });
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    try {
      const result = exportSpecAsJson(dashboardSpec());
      expect(result.ok).toBe(true);
      expect(anchor.download).toBe("Dashboard.json");
      expect(click).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:export");
      expect(alerts).toEqual([]);
      expect(specsDir()).toEqual([]);
      expect(useDocumentStore.getState().fileName).toBe("original.json");
    } finally {
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
    }
  });
});

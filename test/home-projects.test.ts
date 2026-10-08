import { beforeEach, describe, expect, it, vi } from "vitest";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { homeFirstBatch, loadWorkspaceProjects, loadWorkspaceProjectsProgressively } from "@/features/editor/ui/homeProjects";
import { listWorkspaceFileEntries, readWorkspaceSpecSnapshot } from "@/features/editor/ui/workspaceClient";

vi.mock("@/features/editor/ui/workspaceClient", () => ({
  listWorkspaceFileEntries: vi.fn(), readWorkspaceSpecSnapshot: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readWorkspaceSpecSnapshot).mockResolvedValue({ text: JSON.stringify(blankSpec), revision: "disk-version" });
});

describe("홈 최근 수정순", () => {
  it("파일명과 무관하게 최신순, 동률은 파일명순이며 0도 유효하다", async () => {
    vi.mocked(listWorkspaceFileEntries).mockResolvedValue([
      {name: "a-old.json", mtimeMs: 0}, {name: "z-new.json", mtimeMs: 20},
      {name: "b-tie.json", mtimeMs: 10}, {name: "a-tie.json", mtimeMs: 10},
    ]);
    expect((await loadWorkspaceProjects())?.map(p => p.fileName)).toEqual([
      "z-new.json", "a-tie.json", "b-tie.json", "a-old.json",
    ]);
  });
  it("목록 이후 삭제됐거나 파싱할 수 없는 파일은 나머지 순서에 영향 없이 제외한다", async () => {
    vi.mocked(listWorkspaceFileEntries).mockResolvedValue([
      {name: "gone.json", mtimeMs: 30}, {name: "broken.json", mtimeMs: 20}, {name: "keep.json", mtimeMs: 10},
    ]);
    vi.mocked(readWorkspaceSpecSnapshot).mockImplementation(async path =>
      path.endsWith("gone.json") ? null : { text: path.endsWith("broken.json") ? "null" : JSON.stringify(blankSpec), revision: "disk-version" },
    );
    expect((await loadWorkspaceProjects())?.map(p => p.fileName)).toEqual(["keep.json"]);
  });
  it("작업공간 미연결과 빈 폴더를 구분한다", async () => {
    vi.mocked(listWorkspaceFileEntries).mockResolvedValue(null);
    expect(await loadWorkspaceProjects()).toBeNull();
    vi.mocked(listWorkspaceFileEntries).mockResolvedValue([]);
    expect(await loadWorkspaceProjects()).toEqual([]);
  });
});

describe("홈 목록을 앞에서부터 묶음으로 낸다 (#316)", () => {
  const entries = (count: number) => Array.from({ length: count }, (_, i) => ({ name: `p${String(i).padStart(2, "0")}.json`, mtimeMs: 100 - i }));

  it("최종 순서 그대로 앞에서부터 이어 붙이고, 마지막에만 done이다", async () => {
    vi.mocked(listWorkspaceFileEntries).mockResolvedValue(entries(5));
    const calls: { names: string[]; done: boolean }[] = [];
    expect(await loadWorkspaceProjectsProgressively((projects, done) => calls.push({ names: projects.map((p) => p.fileName), done }), { firstBatch: 2, batch: 2 })).toBe(true);
    expect(calls).toEqual([
      { names: ["p00.json", "p01.json"], done: false },
      { names: ["p00.json", "p01.json", "p02.json", "p03.json"], done: false },
      { names: ["p00.json", "p01.json", "p02.json", "p03.json", "p04.json"], done: true },
    ]);
    expect((await loadWorkspaceProjects())?.map((p) => p.fileName)).toEqual(calls[2].names);
  });

  it("첫 묶음과 뒤 묶음의 크기를 따로 둔다", async () => {
    vi.mocked(listWorkspaceFileEntries).mockResolvedValue(entries(7));
    const sizes: number[] = [];
    await loadWorkspaceProjectsProgressively((projects) => sizes.push(projects.length), { firstBatch: 2, batch: 4 });
    expect(sizes).toEqual([2, 6, 7]);
  });

  it("깨진 파일은 빠지되 이미 낸 카드의 순서는 그대로다", async () => {
    vi.mocked(listWorkspaceFileEntries).mockResolvedValue(entries(4));
    vi.mocked(readWorkspaceSpecSnapshot).mockImplementation(async (path) =>
      ({ text: path.endsWith("p01.json") ? "{" : JSON.stringify(blankSpec), revision: "r" }));
    const calls: string[][] = [];
    await loadWorkspaceProjectsProgressively((projects) => calls.push(projects.map((p) => p.fileName)), { firstBatch: 2, batch: 2 });
    expect(calls).toEqual([["p00.json"], ["p00.json", "p02.json", "p03.json"]]);
  });

  it("취소하면 그 자리에서 멈추고, 빈 폴더는 빈 목록 한 번(done)이다", async () => {
    vi.mocked(listWorkspaceFileEntries).mockResolvedValue(entries(6));
    let cancelled = false;
    const calls: number[] = [];
    await loadWorkspaceProjectsProgressively((projects) => { calls.push(projects.length); cancelled = true; }, { firstBatch: 2, batch: 2, isCancelled: () => cancelled });
    expect(calls).toEqual([2]);

    vi.mocked(listWorkspaceFileEntries).mockResolvedValue([]);
    const empty: [number, boolean][] = [];
    expect(await loadWorkspaceProjectsProgressively((projects, done) => empty.push([projects.length, done]))).toBe(true);
    expect(empty).toEqual([[0, true]]);
  });
});

describe("첫 묶음 크기는 창으로 어림한 첫 화면 카드 수다 (#316)", () => {
  it("열 수 × (보이는 행 + 1), 최소 12, 창을 모르면 24", () => {
    expect(homeFirstBatch(1600, 1000)).toBe(7 * 6); // 측정 창 — 보이는 카드 약 40장을 한 묶음에
    expect(homeFirstBatch(1400, 1000)).toBe(6 * 6);
    expect(homeFirstBatch(400, 300)).toBe(12);
    expect(homeFirstBatch(0, 0)).toBe(24);
  });
});


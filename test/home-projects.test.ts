import { beforeEach, describe, expect, it, vi } from "vitest";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { loadWorkspaceProjects } from "@/features/editor/ui/homeProjects";
import { listWorkspaceFileEntries, readWorkspaceTextFile } from "@/features/editor/ui/workspaceClient";

vi.mock("@/features/editor/ui/workspaceClient", () => ({
  listWorkspaceFileEntries: vi.fn(), readWorkspaceTextFile: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readWorkspaceTextFile).mockResolvedValue(JSON.stringify(blankSpec));
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
    vi.mocked(readWorkspaceTextFile).mockImplementation(async path =>
      path.endsWith("gone.json") ? null : path.endsWith("broken.json") ? "null" : JSON.stringify(blankSpec),
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

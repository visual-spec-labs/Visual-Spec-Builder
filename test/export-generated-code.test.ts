import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { readWorkspaceBinaryFile } = vi.hoisted(() => ({
  readWorkspaceBinaryFile: vi.fn(),
}));

vi.mock("@/features/editor/ui/workspaceClient", () => ({
  listWorkspaceFiles: vi.fn(),
  readWorkspaceBinaryFile,
  readWorkspaceTextFile: vi.fn(),
}));

import { seedSpec } from "@/features/editor/store/seedSpec";
import { verifyGenerated } from "@/features/editor/export/verifyGenerated";
import { downloadGeneratedBundle } from "@/features/editor/ui/exportGeneratedCode";

const files = [{
  path: "pages/Home.tsx",
  content: 'import hero from "../assets/hero.png"; export default hero;',
}];
const report = verifyGenerated({ files, tickets: [], assetNames: ["hero.png"] });

let lastBlob: Blob | null = null;
const click = vi.fn();

function zipEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    entries.set(name, bytes.slice(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  return entries;
}

async function downloadedEntries(): Promise<Map<string, Uint8Array>> {
  if (lastBlob === null) throw new Error("Expected a ZIP download");
  return zipEntries(new Uint8Array(await lastBlob.arrayBuffer()));
}

describe("generated code asset export (#274)", () => {
  beforeEach(() => {
    lastBlob = null;
    click.mockClear();
    readWorkspaceBinaryFile.mockReset();
    vi.stubGlobal("document", {
      createElement: () => ({ href: "", download: "", click }),
    });
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      if (!(blob instanceof Blob)) throw new Error("Expected a Blob download");
      lastBlob = blob;
      return "blob:test";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([false, true])("관계 화면은 이전 보고서와 부분 Export로도 ZIP을 만들지 않는다 (%s)", async allowPartial => {
    const result = await downloadGeneratedBundle("Demo", files, report, [],
      { ...seedSpec.screen, kind: "modal" }, allowPartial);
    expect(result.kind).toBe("unsupported");
    expect(readWorkspaceBinaryFile).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it("읽기 실패 때 전체 ZIP을 만들지 않고 재시도 대상을 돌려준다", async () => {
    readWorkspaceBinaryFile.mockResolvedValue(null);

    const result = await downloadGeneratedBundle("Demo", files, report, [], seedSpec.screen);

    expect(result).toEqual({ kind: "missing-assets", missing: ["hero.png"] });
    expect(click).not.toHaveBeenCalled();
    expect(lastBlob).toBeNull();
  });

  it("초기 검사에서 자산이 이미 빠져 있어도 부분 ZIP을 자동으로 만들지 않는다", async () => {
    readWorkspaceBinaryFile.mockResolvedValue(null);
    const initiallyMissing = verifyGenerated({ files, tickets: [], assetNames: [] });

    const result = await downloadGeneratedBundle("Demo", files, initiallyMissing, [], seedSpec.screen);

    expect(result).toEqual({ kind: "missing-assets", missing: ["hero.png"] });
    expect(click).not.toHaveBeenCalled();
  });

  it("asset endpoint의 네트워크 예외도 성공 다운로드로 처리하지 않는다", async () => {
    readWorkspaceBinaryFile.mockRejectedValue(new Error("network failure"));

    const result = await downloadGeneratedBundle("Demo", files, report, [], seedSpec.screen);

    expect(result).toEqual({ kind: "missing-assets", missing: ["hero.png"] });
    expect(click).not.toHaveBeenCalled();
  });

  it("다시 시도하면 자산을 새로 읽어 전체 ZIP을 만들 수 있다", async () => {
    readWorkspaceBinaryFile
      .mockResolvedValueOnce(null)
      .mockResolvedValue(new Uint8Array([4, 5, 6]));

    const failed = await downloadGeneratedBundle("Demo", files, report, [], seedSpec.screen);
    const retried = await downloadGeneratedBundle("Demo", files, report, [], seedSpec.screen);

    expect(failed.kind).toBe("missing-assets");
    expect(retried).toEqual({ kind: "downloaded", missing: [] });
    expect(readWorkspaceBinaryFile).toHaveBeenCalledTimes(2);
    expect(click).toHaveBeenCalledTimes(1);
    const entries = await downloadedEntries();
    expect([...(entries.get("demo/assets/hero.png") ?? [])]).toEqual([4, 5, 6]);
  });

  it("부분 Export를 명시한 경우 실제 읽힌 파일만 넣고 누락을 README에 기록한다", async () => {
    readWorkspaceBinaryFile.mockResolvedValue(null);

    const result = await downloadGeneratedBundle("Demo", files, report, [], seedSpec.screen, true);

    expect(result).toEqual({ kind: "downloaded", missing: ["hero.png"] });
    const entries = await downloadedEntries();
    expect(entries.has("demo/assets/hero.png")).toBe(false);
    const readme = new TextDecoder().decode(entries.get("demo/README.md"));
    expect(readme).toContain("이미지입니다: hero.png");
    expect(readme).toContain("오류 1건");
  });

  it("최종 ZIP에 들어간 실제 자산 바이트로 보고서를 다시 검증한다", async () => {
    readWorkspaceBinaryFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const result = await downloadGeneratedBundle("Demo", files, report, [], seedSpec.screen);

    expect(result).toEqual({ kind: "downloaded", missing: [] });
    const entries = await downloadedEntries();
    expect([...(entries.get("demo/assets/hero.png") ?? [])]).toEqual([1, 2, 3]);
    const readme = new TextDecoder().decode(entries.get("demo/README.md"));
    expect(readme).toContain("오류 0건");
  });
});

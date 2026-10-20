import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importImageFile, loadImageAsset } from "@/features/editor/ui/importImageFromFile";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { seedSpec } from "@/features/editor/store/seedSpec";

const workspace = vi.hoisted(() => ({
  listWorkspaceFiles: vi.fn(), writeWorkspaceFile: vi.fn(),
}));
vi.mock("@/features/editor/ui/workspaceClient", () => workspace);

beforeEach(() => {
  vi.stubGlobal("Image", class {
    naturalWidth = 600; naturalHeight = 200;
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  vi.stubGlobal("FileReader", class {
    result = "data:image/png;base64,cHJlc2VydmVk";
    onload?: () => void;
    readAsDataURL() { queueMicrotask(() => this.onload?.()); }
  });
  workspace.listWorkspaceFiles.mockResolvedValue([]);
  workspace.writeWorkspaceFile.mockImplementation(async (path: string) => ({ ok: true, path }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("shared ImageNode/background asset importer", () => {
  it("replaces the selected image source as one undoable edit and keeps its layout", async () => {
    useEditorStore.getState().loadSpec(structuredClone(seedSpec));
    useEditorStore.getState().insertNode("root", "photo", {
      type: "image", name: "Photo", box: { width: 240, height: 120 },
      src: "assets/old.png", fit: "contain",
    });
    const file = new File(["replacement"], "new.png", { type: "image/png" });

    useEditorStore.getState().select("photo");
    await importImageFile(file);

    const page = useEditorStore.getState().spec.pages.page1;
    expect(page.nodes.photo).toMatchObject({
      type: "image", name: "Photo", box: { width: 240, height: 120 },
      src: expect.stringMatching(/^assets\/new-[a-f0-9-]+\.png$/), fit: "contain",
    });
    expect(Object.keys(page.nodes)).toHaveLength(Object.keys(seedSpec.screen.nodes).length + 1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().spec.pages.page1.nodes.photo).toMatchObject({
      src: "assets/old.png", box: { width: 240, height: 120 }, fit: "contain",
    });

    useEditorStore.getState().select("photo");
    await importImageFile(file);
    const savedSpec = JSON.parse(JSON.stringify(useEditorStore.getState().spec));
    useEditorStore.getState().loadSpec(savedSpec);
    expect(useEditorStore.getState().spec.pages.page1.nodes.photo).toMatchObject({
      src: expect.stringMatching(/^assets\/new-[a-f0-9-]+\.png$/),
    });
  });

  it("adds a new image when no image node is selected", async () => {
    useEditorStore.getState().loadSpec(structuredClone(seedSpec));
    await importImageFile(new File(["new"], "new.png", { type: "image/png" }));

    const page = useEditorStore.getState().spec.pages.page1;
    expect(Object.values(page.nodes).filter((node) => node.type === "image")).toHaveLength(1);
  });

  it("concurrent same-name imports keep distinct paths and original bytes", async () => {
    const writes = new Map<string, string>();
    workspace.writeWorkspaceFile.mockImplementation(async (path: string, file: File) => {
      writes.set(path, await file.text());
      return { ok: true, path };
    });
    const [first, second] = await Promise.all([
      loadImageAsset(new File(["first"], "same.png", { type: "image/png" })),
      loadImageAsset(new File(["second"], "same.png", { type: "image/png" })),
    ]);
    expect(first?.src).toMatch(/^assets\/same-[a-f0-9-]+\.png$/);
    expect(second?.src).not.toBe(first?.src);
    expect(writes.get(first!.src)).toBe("first");
    expect(writes.get(second!.src)).toBe("second");
  });
  it("preserves data URI if workspace writing fails", async () => {
    workspace.writeWorkspaceFile.mockResolvedValue({ ok: false, error: "disk unavailable" });
    const image = await loadImageAsset(new File(["source"], "photo.png", { type: "image/png" }));
    expect(image).toEqual({ src: "data:image/png;base64,cHJlc2VydmVk", width: 600, height: 200 });
  });
  it("never writes without collision-resistant names and uses the embedded fallback", async () => {
    vi.stubGlobal("crypto", {});
    const image = await loadImageAsset(new File(["source"], "photo.png", { type: "image/png" }));
    expect(workspace.writeWorkspaceFile).not.toHaveBeenCalled();
    expect(image?.src).toMatch(/^data:image/);
  });
});

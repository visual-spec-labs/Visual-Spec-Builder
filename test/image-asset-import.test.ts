import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importImageFile, loadImageAsset } from "@/features/editor/ui/importImageFromFile";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { seedSpec } from "@/features/editor/store/seedSpec";

const workspace = vi.hoisted(() => ({
  listWorkspaceFiles: vi.fn(), writeWorkspaceFile: vi.fn(),
}));
vi.mock("@/features/editor/ui/workspaceClient", () => workspace);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

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

  it("keeps the replacement target captured before delayed file I/O", async () => {
    useEditorStore.getState().loadSpec(structuredClone(seedSpec));
    useEditorStore.getState().insertNode("root", "photoA", {
      type: "image", name: "A", box: { width: 100, height: 80 }, src: "a.png", fit: "cover",
    });
    useEditorStore.getState().insertNode("root", "photoB", {
      type: "image", name: "B", box: { width: 100, height: 80 }, src: "b.png", fit: "cover",
    });
    useEditorStore.getState().select("photoA");
    const listing = deferred<[]>();
    workspace.listWorkspaceFiles.mockReturnValueOnce(listing.promise);

    const pending = importImageFile(new File(["new"], "replacement.png", { type: "image/png" }));
    await vi.waitFor(() => expect(workspace.listWorkspaceFiles).toHaveBeenCalledTimes(1));
    useEditorStore.getState().select("photoB");
    listing.resolve([]);
    await pending;

    const page = useEditorStore.getState().spec.pages.page1;
    expect(page.nodes.photoA).toMatchObject({ src: expect.stringMatching(/^assets\/replacement-/) });
    expect(page.nodes.photoB).toMatchObject({ src: "b.png" });
  });

  it("cancels when the captured image is deleted and its ID is reused", async () => {
    vi.stubGlobal("window", { alert: vi.fn() });
    useEditorStore.getState().loadSpec(structuredClone(seedSpec));
    useEditorStore.getState().insertNode("root", "photo", {
      type: "image", name: "Photo", box: { width: 100, height: 80 }, src: "old.png", fit: "cover",
    });
    const listing = deferred<[]>();
    workspace.listWorkspaceFiles.mockReturnValueOnce(listing.promise);
    const pending = importImageFile(new File(["new"], "replacement.png", { type: "image/png" }));
    await vi.waitFor(() => expect(workspace.listWorkspaceFiles).toHaveBeenCalledTimes(1));

    useEditorStore.getState().removeNode("photo");
    useEditorStore.getState().insertNode("root", "photo", {
      type: "image", name: "New Photo", box: { width: 120, height: 90 }, src: "new-image.png", fit: "contain",
    });
    listing.resolve([]);
    await pending;

    expect(useEditorStore.getState().spec.pages.page1.nodes.photo).toMatchObject({
      name: "New Photo", src: "new-image.png", box: { width: 120, height: 90 }, fit: "contain",
    });
    expect(window.alert).toHaveBeenCalledOnce();
  });

  it("cancels a delayed import when its page is no longer active", async () => {
    vi.stubGlobal("window", { alert: vi.fn() });
    useEditorStore.getState().loadSpec(structuredClone(seedSpec));
    const listing = deferred<[]>();
    workspace.listWorkspaceFiles.mockReturnValueOnce(listing.promise);
    const pending = importImageFile(new File(["new"], "late.png", { type: "image/png" }));
    await vi.waitFor(() => expect(workspace.listWorkspaceFiles).toHaveBeenCalledTimes(1));

    useEditorStore.getState().addPage();
    listing.resolve([]);
    await pending;

    expect(Object.values(useEditorStore.getState().spec.pages.page1.nodes).some((node) => node.type === "image")).toBe(false);
    expect(window.alert).toHaveBeenCalledOnce();
  });

  it("cancels a delayed import after another document replaces the captured one", async () => {
    vi.stubGlobal("window", { alert: vi.fn() });
    useEditorStore.getState().loadSpec(structuredClone(seedSpec));
    const listing = deferred<[]>();
    workspace.listWorkspaceFiles.mockReturnValueOnce(listing.promise);
    const pending = importImageFile(new File(["new"], "late.png", { type: "image/png" }));
    await vi.waitFor(() => expect(workspace.listWorkspaceFiles).toHaveBeenCalledTimes(1));

    useEditorStore.getState().loadSpec(structuredClone(seedSpec));
    listing.resolve([]);
    await pending;

    expect(Object.values(useEditorStore.getState().spec.pages.page1.nodes).some((node) => node.type === "image")).toBe(false);
    expect(window.alert).toHaveBeenCalledOnce();
  });

  it("keeps overlapping imports as two insertions even after the first selects its node", async () => {
    useEditorStore.getState().loadSpec(structuredClone(seedSpec));
    const firstList = deferred<[]>();
    const secondList = deferred<[]>();
    workspace.listWorkspaceFiles
      .mockReturnValueOnce(firstList.promise)
      .mockReturnValueOnce(secondList.promise);

    const first = importImageFile(new File(["first"], "first.png", { type: "image/png" }));
    const second = importImageFile(new File(["second"], "second.png", { type: "image/png" }));
    await vi.waitFor(() => expect(workspace.listWorkspaceFiles).toHaveBeenCalledTimes(2));
    firstList.resolve([]);
    await first;
    secondList.resolve([]);
    await second;

    const images = Object.values(useEditorStore.getState().spec.pages.page1.nodes)
      .filter((node) => node.type === "image");
    expect(images).toHaveLength(2);
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

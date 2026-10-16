import { describe, expect, it } from "vitest";
import type { FrameNode, ProjectSpec } from "@/features/editor/schema";
import { compileProjectTickets } from "@/features/editor/ticket";
import { canonicalJson, sha256Hex } from "@/features/editor/export/contentHash";
import { buildProjectInputSnapshot, createProjectAssetSnapshot, parseProjectInputSnapshot, projectAssetMediaType, projectAssetPaths, projectInputSnapshotPath } from "@/features/editor/ticket/projectInputSnapshot";
import fixture from "./fixtures/screen-relations-project.json";

const contentHash = (text: string) => sha256Hex(new TextEncoder().encode(text));
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
function project(): ProjectSpec {
  const source = { ...structuredClone(fixture) as unknown as ProjectSpec, projectId: "input-project" };
  (source.pages.login.nodes.root as FrameNode).background = [{ type: "image", src: "assets/hero.png", fit: "cover" }];
  return source;
}
function setup() {
  const source = project(); const plan = compileProjectTickets(source);
  const asset = createProjectAssetSnapshot("assets/hero.png", png);
  return { source, plan, asset, snapshot: buildProjectInputSnapshot("request_1", source, plan, [asset]) };
}

describe("immutable project input bytes", () => {
  it("serializes a detached canonical snapshot with exact asset bytes", () => {
    const { source, plan, asset, snapshot } = setup();
    const before = structuredClone(source);
    expect(snapshot.path).toBe("runtime/project-input-request_1.json");
    expect(snapshot.sha256).toBe(contentHash(snapshot.content));
    const parsed = parseProjectInputSnapshot(snapshot.content, snapshot.sha256, "request_1");
    expect(parsed, JSON.stringify(parsed)).toMatchObject({ ok: true });
    if (!parsed.ok) throw Error(parsed.error);
    expect(parsed.snapshot.project).toEqual(source);
    expect(parsed.snapshot.plan).toEqual(plan);
    expect(parsed.snapshot.assets).toEqual([asset]);
    source.pages.login.name = "changed after capture";
    expect(parsed.snapshot.project).toEqual(before);
    expect(snapshot.content).not.toContain("changed after capture");
  });

  it("is independent of object key insertion order and normalizes mapping order", () => {
    const source = project();
    (source.pages.login.nodes.root as FrameNode).background!.push({ type: "image", src: "assets/second.png", fit: "contain" });
    const plan = compileProjectTickets(source);
    const assets = [createProjectAssetSnapshot("assets/hero.png", png), createProjectAssetSnapshot("assets/second.png", png)];
    const snapshot = buildProjectInputSnapshot("request_1", source, plan, assets);
    const reordered = Object.fromEntries(Object.entries(source).reverse()) as unknown as ProjectSpec;
    expect(buildProjectInputSnapshot("request_1", reordered, plan, [...assets].reverse())).toEqual(snapshot);
    expect(parseProjectInputSnapshot(snapshot.content, snapshot.sha256, "request_1").ok).toBe(true);
  });

  it("includes responsive/hidden assets and excludes widget-only sources", () => {
    const source = project();
    source.pages.login.nodes.root.visible = false;
    source.pages.login.responsive = { breakpoints: { wide: { minWidthPx: 900 } }, overrides: { wide: { root: { background: [{ type: "image", src: "assets/wide.png", fit: "cover" }] } } } };
    (source.pages.notificationWidget.nodes.root as FrameNode).background = [{ type: "image", src: "assets/widget.png", fit: "cover" }];
    expect(projectAssetPaths(source)).toEqual(["assets/hero.png", "assets/wide.png"]);
    expect(() => buildProjectInputSnapshot("r", source, compileProjectTickets(source), [createProjectAssetSnapshot("assets/hero.png", png)])).toThrow(/mapping/);
  });

  it("keeps inline and external images in the project while rejecting unresolved local references", () => {
    const source = project();
    const root = source.pages.login.nodes.root as FrameNode;
    root.background = [{ type: "image", src: "https://example.test/hero.png", fit: "cover" }, { type: "image", src: "data:image/png;base64," + Buffer.from(png).toString("base64"), fit: "contain" }];
    const snapshot = buildProjectInputSnapshot("r", source, compileProjectTickets(source), []);
    expect(snapshot.content).toContain("https://example.test/hero.png");
    expect(snapshot.content).toContain("data:image/png;base64,");
    for (const path of ["assets/../hero.png", "blob:ephemeral", "unresolved-id", "/public/hero.png"]) {
      root.background = [{ type: "image", src: path, fit: "cover" }];
      expect(() => buildProjectInputSnapshot("r", source, compileProjectTickets(source), [])).toThrow(/보존할 수 없는/);
    }
  });

  it("maps equal JPEG bytes to canonical .jpg regardless of the source extension", () => {
    const bytes = new Uint8Array([255, 216, 255, 224, 0, 0]);
    const first = createProjectAssetSnapshot("assets/a.jpg", bytes);
    const second = createProjectAssetSnapshot("assets/b.jpeg", bytes);
    expect(first.zipPath).toBe(second.zipPath);
    expect(first.zipPath).toMatch(/^assets\/[a-f0-9]{64}\.jpg$/);
    expect(createProjectAssetSnapshot("assets/misnamed.jpg", png).mediaType).toBe("image/png");
  });

  it.each(["../bad", "", "a/b", "a".repeat(129)])("rejects unsafe request ID %j", id => {
    expect(() => projectInputSnapshotPath(id)).toThrow();
  });

  it.each([
    ["hash", (v: Record<string, unknown>) => { v.sha256 = "0".repeat(64); }],
    ["length", v => { v.byteLength = 1; }],
    ["type", v => { v.mediaType = "image/jpeg"; }],
    ["zip path", v => { v.zipPath = "assets/elsewhere.png"; }],
    ["source path", v => { v.sourcePath = "assets/other.png"; }],
    ["invalid bytes", v => { v.dataBase64 = "%%"; }],
    ["noncanonical base64", v => { v.dataBase64 = `${v.dataBase64}\n`; }],
    ["extra key", v => { v.extra = true; }],
  ] satisfies [string, (v: Record<string, unknown>) => void][])("rejects recomputed outer hash after tampering with asset %s", (_, change) => {
    const { snapshot } = setup();
    const value = JSON.parse(snapshot.content); change(value.assets[0]);
    const content = canonicalJson(value);
    expect(parseProjectInputSnapshot(content, contentHash(content), "request_1").ok).toBe(false);
  });

  it("rejects altered bytes, wrong request, stale plan, duplicate or extra assets", () => {
    const { source, plan, asset, snapshot } = setup();
    expect(parseProjectInputSnapshot(snapshot.content + " ", snapshot.sha256, "request_1").ok).toBe(false);
    expect(parseProjectInputSnapshot(snapshot.content, snapshot.sha256, "other").ok).toBe(false);
    expect(() => buildProjectInputSnapshot("r", source, plan, [asset, asset])).toThrow(/중복/);
    expect(() => buildProjectInputSnapshot("r", source, plan, [asset, createProjectAssetSnapshot("assets/extra.png", png)])).toThrow(/mapping/);
    source.pages.login.name = "renamed";
    expect(() => buildProjectInputSnapshot("r", source, plan, [asset])).toThrow();
  });

  it("classifies supported byte signatures without trusting filenames", () => {
    expect(projectAssetMediaType(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(projectAssetMediaType(new TextEncoder().encode("RIFF0000WEBP"))).toBe("image/webp");
    expect(projectAssetMediaType(new Uint8Array([0, 0, 0, 16, ...new TextEncoder().encode("ftypavif"), 0, 0, 0, 0]))).toBe("image/avif");
    expect(projectAssetMediaType(new TextEncoder().encode("BM"))).toBe("image/bmp");
    expect(projectAssetMediaType(new Uint8Array([0, 0, 1, 0]))).toBe("image/x-icon");
    expect(projectAssetMediaType(new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe("image/svg+xml");
    expect(() => projectAssetMediaType(new TextEncoder().encode("not an image"))).toThrow();
  });
});

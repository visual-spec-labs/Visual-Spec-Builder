import { describe, expect, it } from "vitest";
import type { FrameNode, ProjectSpec } from "@/features/editor/schema";
import { compileProjectTickets } from "@/features/editor/ticket";
import { canonicalJson, sha256Hex } from "@/features/editor/export/contentHash";
import { buildProjectInputSnapshot, createProjectAssetSnapshot, parseProjectInputSnapshot } from "@/features/editor/ticket/projectInputSnapshot";
import { resolveWorkspaceFile } from "@/features/workspace/workspacePath";
import fixture from "./fixtures/screen-relations-project.json";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
function source(paths: string[]) {
  const project = { ...structuredClone(fixture) as unknown as ProjectSpec, projectId: "review" };
  (project.pages.login.nodes.root as FrameNode).background = paths.map(src => ({ type: "image", src, fit: "cover" }));
  return project;
}

describe("#395 review regressions", () => {
  it.each([':', '*', '?', '"', '<', '>', '|', '\u007f', '\u0001', '\\'])('shares forbidden segment character %j with the reader', character => {
    const path = `assets/a${character}b.png`;
    expect(resolveWorkspaceFile("/tmp/workspace", path.split("/").map(encodeURIComponent).join("/")).ok).toBe(false);
    expect(() => createProjectAssetSnapshot(path, png)).toThrow();
  });
  it.each(['assets/nested/hero.png', 'assets/한 글%#.png'])('retains supported decoded paths: %s', path => {
    expect(resolveWorkspaceFile("/tmp/workspace", path.split("/").map(encodeURIComponent).join("/")).ok).toBe(true);
    const project = source([path]);
    const built = buildProjectInputSnapshot("review", project, compileProjectTickets(project), [createProjectAssetSnapshot(path, png)]);
    expect(parseProjectInputSnapshot(built.content, built.sha256, "review").ok).toBe(true);
  });
  it('budgets aggregate base64 without changing documents or assets', () => {
    const project = source(['assets/a.png', 'assets/b.png']);
    const plan = compileProjectTickets(project);
    const original = canonicalJson({ project, plan });
    const bytes = new Uint8Array(13 * 1024 * 1024); bytes.set(png);
    const asset = createProjectAssetSnapshot('assets/a.png', bytes);
    const assets = [asset, { ...asset, sourcePath: 'assets/b.png' }];
    expect(() => buildProjectInputSnapshot('review', project, plan, assets)).toThrow(/32 MiB/);
    expect(canonicalJson({ project, plan })).toBe(original);
    expect(assets[0].dataBase64).toBe(asset.dataBase64);
  }, 30_000);
  it('includes document and JSON overhead in the final budget', () => {
    const project = source([]);
    const plan = compileProjectTickets(project);
    plan.tickets[0].status = 'failed';
    plan.tickets[0].error = '한'.repeat(12 * 1024 * 1024);
    expect(() => buildProjectInputSnapshot('review', project, plan, [])).toThrow(/32 MiB/);
    expect(plan.tickets[0].error.length).toBe(12 * 1024 * 1024);
  }, 30_000);
  it('counts UTF-8 bytes before parsing or hashing', () => {
    const content = '한'.repeat(12 * 1024 * 1024);
    expect(content.length).toBeLessThan(32 * 1024 * 1024);
    expect(parseProjectInputSnapshot(content, '0'.repeat(64), 'review')).toEqual({ ok: false, error: expect.stringMatching(/32 MiB/) });
  });
  it("does not certify a source rejected by the workspace reader", () => {
    const path = "assets/a:b.png";
    expect(resolveWorkspaceFile("/tmp/workspace", path.split("/").map(encodeURIComponent).join("/")).ok).toBe(false);
    expect(() => createProjectAssetSnapshot(path, png)).toThrow();
  });
  it("rejects a reversed asset array even with a valid recomputed outer hash", () => {
    const paths = ["assets/a.png", "assets/b.png"];
    const project = source(paths);
    const snapshot = buildProjectInputSnapshot("review", project, compileProjectTickets(project), paths.map(path => createProjectAssetSnapshot(path, png)));
    const value = JSON.parse(snapshot.content); value.assets.reverse();
    const content = canonicalJson(value);
    expect(parseProjectInputSnapshot(content, sha256Hex(new TextEncoder().encode(content)), "review").ok).toBe(false);
  });
  it("rejects a 25 MiB asset whose base64 alone exceeds the 32 MiB PUT budget", () => {
    const large = new Uint8Array(25 * 1024 * 1024); large.set(png);
    expect(() => createProjectAssetSnapshot("assets/large.png", large)).toThrow(/32 MiB/);
  }, 30_000);
});

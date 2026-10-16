import { describe, expect, it } from "vitest";
import { rewriteProjectAssetModule } from "@/features/editor/export/projectAssetModules";
import { createProjectAssetSnapshot } from "@/features/editor/ticket/projectInputSnapshot";
const asset = createProjectAssetSnapshot('assets/a.svg', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" />'));
const token = `vsb-asset:${asset.sha256}`;
const transform = (source: string, modulePath = 'login/pages/Login.tsx') => rewriteProjectAssetModule({ source, modulePath, ownedModulePaths: ['login/pages/Login.tsx', 'runtime/Host.tsx'], assets: [asset], externalUrls: ['https://example.test/a.png'] });
describe('project asset module transform', () => {
  it('uses static module URLs and one collision-free binding for img and backgrounds', async () => {
    const source = `const vsbAsset0 = 7; export default () => <div style={{ backgroundImage: 'linear-gradient(red, blue), url("${token}")' }}><img src="${token}" /><img src={'${token}'} /></div>`;
    const { code, usedAssets } = await transform(source);
    expect(code).toContain(`const vsbAsset1 = new URL("../../${asset.zipPath}", import.meta.url).href;`);
    expect(code.match(/new URL/g)).toHaveLength(1); expect(code.match(/src=\{vsbAsset1\}/g)).toHaveLength(2);
    expect(code).toContain('"linear-gradient(red, blue), url(\\\"" + vsbAsset1 + "\\\")"');
    expect(usedAssets).toEqual([asset.sha256]);
  });
  it('derives host-relative URL and preserves directives, comments and ordinary text', async () => {
    const source = `"use client"; // ${token}\nconst display = "${token}"; export default () => <img src="${token}" />;`;
    const { code } = await transform(source, 'runtime/Host.tsx');
    expect(code.startsWith('"use client";')).toBe(true);
    expect(code).toContain(`new URL("../${asset.zipPath}", import.meta.url)`);
    expect(code).toContain(`// ${token}`); expect(code).toContain(`const display = "${token}"`);
  });
  it('preserves allowlisted external image references without adding bindings', async () => {
    const source = 'export default () => <img src="https://example.test/a.png" />';
    expect(await transform(source)).toEqual({ code: source, usedAssets: [] });
  });
  it.each([
    '<img src="../assets/a.png" />', '<img src={path} />', '<img {...props} />', '<img srcSet="a.png 1x" />',
    '<img src="https://other.test/a.png" />', '<div {...props} />', '<div style={styles} />', '<div style={{...styles}} />',
    '<div style={{backgroundImage: `url(${path})`}} />', '<div style={{backgroundImage: "image-set(url(a.png))"}} />',
    'import image from "./image.png"; <img src={image} />', '<div style={{backgroundImage: "url(../a.png)"}} />',
  ])('rejects unsupported/dynamic asset position: %s', async source => { await expect(transform(source)).rejects.toThrow(); });
  it('rejects unknown token, URL constructor shadow, syntax errors and unowned output', async () => {
    await expect(transform(`<img src="vsb-asset:${'0'.repeat(64)}" />`)).rejects.toThrow(/mapping/);
    await expect(transform(`const URL = Other; <img src="${token}" />`)).rejects.toThrow(/충돌/);
    await expect(transform('export const =')).rejects.toThrow();
    await expect(transform(`<img src="${token}" />`, '../escape.tsx')).rejects.toThrow(/계획/);
  });
  it('accepts static template literals without treating interpolation as static', async () => {
    const source = '<img src={`' + token + '`} style={{backgroundImage: `url("' + token + '")`}} />';
    const { code } = await transform(source);
    expect(code).toContain('src={vsbAsset0}'); expect(code.match(/new URL/g)).toHaveLength(1);
  });
  it('keeps multiple url() replacements ordered and reuses bindings', async () => {
    const { code } = await transform(`<div style={{background: 'url(${token}), url("${token}") center'}} />`);
    expect(code.match(/new URL/g)).toHaveLength(1);
    expect(code).toContain(' + vsbAsset0 + '); expect(code).toContain('center');
  });
});

describe('asset transform review regressions', () => {
  it.each(['import("./theme.css")', 'import("./image.svg?url")', 'require("./image.png")'])('rejects direct asset dependency %s', async source => {
    await expect(transform(source)).rejects.toThrow();
  });
  it('rejects an asset token in a background outside url()', async () => {
    await expect(transform(`<div style={{backgroundImage:"${token}"}} />`)).rejects.toThrow();
  });
});

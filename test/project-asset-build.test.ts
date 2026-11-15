import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { rewriteProjectAssetModule } from "@/features/editor/export/projectAssetModules";
import { createProjectAssetSnapshot } from "@/features/editor/ticket/projectInputSnapshot";

it.runIf(process.env.VSB_PROJECT_ASSET_BROWSER === '1')('AST transformed source typechecks/builds and decodes at root and nested deployment', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vsb-project-assets-'));
  try {
    for (const path of ['login/pages', 'runtime', 'assets']) mkdirSync(join(directory, path), { recursive: true });
    symlinkSync(resolve('node_modules'), join(directory, 'node_modules'), 'dir');
    const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="red" /></svg>');
    const asset = createProjectAssetSnapshot('assets/source.svg', bytes);
    const token = `vsb-asset:${asset.sha256}`;
    const ownedModulePaths = ['login/pages/Login.tsx', 'runtime/Host.tsx'];
    const page = await rewriteProjectAssetModule({ modulePath: ownedModulePaths[0], ownedModulePaths, assets: [asset],
      source: `import React from 'react'; export default function Page() { return <><img id="page-image" src="${token}"/><div id="background" style={{width:20,height:20,backgroundImage:'url("${token}")'}} /></>; }` });
    const host = await rewriteProjectAssetModule({ modulePath: ownedModulePaths[1], ownedModulePaths, assets: [asset],
      source: `import React from 'react'; import Page from '../login/pages/Login'; export default function Host() { return <><Page/><img id="host-image" src="${token}"/></>; }` });
    writeFileSync(join(directory, ownedModulePaths[0]), page.code); writeFileSync(join(directory, ownedModulePaths[1]), host.code);
    writeFileSync(join(directory, asset.zipPath), bytes);
    writeFileSync(join(directory, 'main.tsx'), 'import React from "react"; import {createRoot} from "react-dom/client"; import Host from "./runtime/Host"; createRoot(document.getElementById("root")!).render(<Host/>);');
    writeFileSync(join(directory, 'index.html'), '<!doctype html><div id="root"></div><script type="module" src="./main.tsx"></script>');
    writeFileSync(join(directory, 'vite.config.mjs'), 'export default {base:"./",build:{assetsInlineLimit:0}};');
    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM'], module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: true, allowSyntheticDefaultImports: true, types: [] }, include: ['**/*.tsx'] }));
    execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', directory], { timeout: 30_000 });
    execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', directory], { timeout: 30_000 });
    const output = execFileSync(process.execPath, [resolve('scripts/browser/project-asset-dist.mjs'), join(directory, 'dist')], { timeout: 30_000, encoding: 'utf8' });
    expect(output).toContain('PASS root and nested');
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 120_000);

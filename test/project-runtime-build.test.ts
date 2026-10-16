import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { expect, it } from "vitest";
import { renderProjectRuntime } from "@/features/editor/export/projectRuntimeTemplates";
import { runtimeFixture } from "./helpers/project-runtime-fixture";
it.runIf(process.env.VSB_PROJECT_RUNTIME_BROWSER === '1')('generated runtime typechecks/builds and preserves page/modal intent in Chromium', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vsb-project-runtime-'));
  const write = (path: string, value: string) => { mkdirSync(dirname(join(directory, path)), { recursive: true }); writeFileSync(join(directory, path), value); };
  try {
    const context = runtimeFixture();
    symlinkSync(resolve('node_modules'), join(directory, 'node_modules'), 'dir');
    for (const [path, code] of renderProjectRuntime(context)) write(path, code);
    for (const ticket of context.snapshot.plan.tickets.filter(t => t.kind === 'page')) {
      const id = ticket.sourcePageId;
      const content = id === 'login' ? '<button id="navigate" onClick={() => actions.onNavigate("dashboard")}>Navigate</button><button id="open" onClick={() => actions.onOpenModal("resetPassword")}>Open</button>'
        : id === 'dashboard' ? '<h1 id="dashboard">Dashboard</h1><button id="back" onClick={() => actions.onNavigate("login")}>Back</button>'
        : `<style>{"#modal-title{font-size:20px}@media(min-width:800px){#modal-title{font-size:32px}}"}</style><h2 id="modal-title">${id}</h2><input aria-label="Name"/><button id="close" onClick={actions.onClose}>Close</button><button id="replace" onClick={() => actions.onOpenModal("otherModal")}>Replace</button><button id="modal-navigate" onClick={() => actions.onNavigate("dashboard")}>Navigate</button>`;
      write(`owned/${id}/pages/${ticket.componentName}.tsx`, `import type { ScreenActions } from '../../runtime/Routes'; export default function Screen(actions:ScreenActions){return <div data-screen="${id}" style={{display:'flex',flexDirection:'column',width:12,height:12,background:'#fff'}}>${content}</div>}`);
    }
    write('main.tsx', 'import {createRoot} from "react-dom/client"; import Entry from "./owned/runtime/Entry"; createRoot(document.getElementById("root")!).render(<Entry/>);');
    write('index.html', '<!doctype html><div id="root"></div><script type="module" src="./main.tsx"></script>');
    write('vite.config.mjs', 'export default {base:"./"};');
    write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: true, allowSyntheticDefaultImports: true, types: [] }, include: ['**/*.tsx', '**/*.ts'] }));
    execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', directory], { timeout: 30_000 });
    execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', directory], { timeout: 30_000 });
    const output = execFileSync(process.execPath, [resolve('scripts/browser/project-runtime-dist.mjs'), join(directory, 'dist')], { timeout: 45_000, encoding: 'utf8' });
    expect(output).toContain('PASS generated runtime');
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 120_000);

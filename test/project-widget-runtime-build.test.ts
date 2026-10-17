import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import type { FrameNode, ProjectSpec } from '@/features/editor/schema';
import { compileProjectTickets } from '@/features/editor/ticket/compileProjectTickets';
import { projectProvenanceContext } from '@/features/editor/export/projectGenerationProvenance';
import { renderProjectRuntime } from '@/features/editor/export/projectRuntimeTemplates';
import fixture from './fixtures/screen-relations-project.json';

it.runIf(process.env.VSB_PROJECT_RUNTIME_BROWSER === '1')('shared widget is generated once, typechecks, builds, and responds in Chromium', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vsb-widget-runtime-'));
  const write = (path: string, value: string) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), value); };
  try {
    const p = { ...structuredClone(fixture) as unknown as ProjectSpec, projectId: 'shared-runtime' };
    p.pages.shared = structuredClone(p.pages.login);
    p.pages.shared.kind = 'widget'; p.pages.shared.name = 'Shared'; p.pageOrder.push('shared');
    for (const pageId of ['login', 'dashboard']) {
      const screen = p.pages[pageId];
      screen.nodes[`instance-${pageId}`] = { type: 'instance', name: 'Shared', box: { width: 240, height: 80 }, ref: 'shared', overrides: {} };
      (screen.nodes.root as FrameNode).children.push({ node: `instance-${pageId}` });
    }
    const plan = compileProjectTickets(p);
    const context = projectProvenanceContext({ protocol: 1, requestId: 'fixture', projectId: p.projectId!, project: p, plan, assets: [] }, 'owned');
    const widget = plan.tickets.find(ticket => ticket.widgetRoot)!;
    expect(widget).toBeDefined();
    symlinkSync(resolve('node_modules'), join(dir, 'node_modules'), 'dir');
    for (const [path, code] of renderProjectRuntime(context)) write(path, code);
    for (const ticket of plan.tickets) {
      const path = `owned/${ticket.sourcePageId}/${ticket.kind === 'page' ? 'pages' : 'components'}/${ticket.componentName}.tsx`;
      if (ticket.widgetRoot) write(path, `export function ${ticket.componentName}({label,onNavigate}:{label:string;onNavigate:(id:string)=>void}){return <button className="shared-widget" onClick={()=>onNavigate("dashboard")}>{label}</button>}`);
      else if (ticket.kind === 'page') {
        const widgetImport = `../../shared/components/${widget.componentName}`;
        const content = ticket.sourcePageId === 'login'
          ? `<${widget.componentName} label="first" onNavigate={actions.onNavigate}/><${widget.componentName} label="second" onNavigate={actions.onNavigate}/>`
          : ticket.sourcePageId === 'dashboard' ? '<h1 id="dashboard">Dashboard</h1>' : '<h1>Modal</h1>';
        write(path, `import type {ScreenActions} from '../../runtime/Routes'; import {${widget.componentName}} from '${widgetImport}'; export default function ${ticket.componentName}(actions:ScreenActions){return <main>${content}</main>}`);
      } else write(path, `export function ${ticket.componentName}(){return <div/>}`);
    }
    write('main.tsx', 'import {createRoot} from "react-dom/client"; import Entry from "./owned/runtime/Entry"; createRoot(document.getElementById("root")!).render(<Entry/>);');
    write('index.html', '<!doctype html><div id="root"></div><script type="module" src="./main.tsx"></script>');
    write('vite.config.mjs', 'export default {base:"./"};');
    write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: true, allowSyntheticDefaultImports: true, types: [] }, include: ['**/*.tsx', '**/*.ts'] }));
    execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', dir], { timeout: 30_000 });
    execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', dir], { timeout: 30_000 });
    const output = execFileSync(process.execPath, [resolve('scripts/browser/project-widget-dist.mjs'), join(dir, 'dist')], { timeout: 45_000, encoding: 'utf8' });
    expect(output).toContain('PASS shared widget runtime');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 120_000);

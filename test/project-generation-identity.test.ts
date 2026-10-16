import { describe, expect, it } from "vitest";
import type { ProjectSpec, ButtonNode, TextNode, FrameNode } from "@/features/editor/schema";
import { compileProjectTickets } from "@/features/editor/ticket/compileProjectTickets";
import { createProjectAssetSnapshot, type ProjectInputSnapshot } from "@/features/editor/ticket/projectInputSnapshot";
import { PROJECT_TEMPLATE_VERSION, projectGenerationFingerprints, projectGenerationPath } from "@/features/editor/export/projectGenerationIdentity";
import fixture from "./fixtures/screen-relations-project.json";
function project() { return { ...structuredClone(fixture) as unknown as ProjectSpec, projectId: 'identity' }; }
function snapshot(p = project()): ProjectInputSnapshot { return { protocol: 1, requestId: 'test', projectId: p.projectId!, project: p, plan: compileProjectTickets(p), assets: [] }; }
const title = (p: ProjectSpec, id: string) => Object.values(p.pages[id].nodes).find(node => node.type === 'text') as TextNode;
describe('project generation identity', () => {
  it('is stable across request IDs and execution progress', () => {
    const s = snapshot(); const before = projectGenerationFingerprints(s);
    s.requestId = 'retry'; s.plan.tickets[0].status = 'failed'; s.plan.tickets[0].error = 'retry';
    expect(projectGenerationFingerprints(s)).toEqual(before);
    expect(projectGenerationPath('identity')).toMatch(/^runtime\/project-generation-[a-f0-9]{64}\.json$/);
    expect(projectGenerationPath('other')).not.toBe(projectGenerationPath('identity'));
  });
  it('tracks openModal closure but excludes navigate target body from the source fingerprint', () => {
    const p = project(); const before = projectGenerationFingerprints(snapshot(p));
    expect(before.closures.login).toEqual(['login', 'resetPassword']);
    title(p, 'dashboard').content += ' changed';
    const after = projectGenerationFingerprints(snapshot(p));
    expect(after.project).not.toBe(before.project);
    expect(after.pages.login).toBe(before.pages.login);
    expect(after.pages.dashboard).not.toBe(before.pages.dashboard);
    title(p, 'resetPassword').content += ' changed';
    expect(projectGenerationFingerprints(snapshot(p)).pages.login).not.toBe(before.pages.login);
  });
  it('terminates cycles and sorts closure IDs', () => {
    const p = project(); p.pages.otherModal = structuredClone(p.pages.resetPassword); p.pageOrder.push('otherModal');
    (p.pages.resetPassword.nodes.closeButton as ButtonNode).action = { type: 'openModal', target: 'otherModal' };
    (p.pages.otherModal.nodes.closeButton as ButtonNode).action = { type: 'openModal', target: 'resetPassword' };
    expect(projectGenerationFingerprints(snapshot(p)).closures.login).toEqual(['login', 'otherModal', 'resetPassword']);
  });
  it('changes project routes with page order without changing page-local fingerprints', () => {
    const p = project(); const before = projectGenerationFingerprints(snapshot(p));
    p.pageOrder = ['dashboard', ...p.pageOrder.filter(id => id !== 'dashboard')];
    const after = projectGenerationFingerprints(snapshot(p));
    expect(after.project).not.toBe(before.project); expect(after.pages).toEqual(before.pages);
  });
  it('includes policy generation and project identity', () => {
    const s = snapshot(); const before = projectGenerationFingerprints(s);
    const next = projectGenerationFingerprints(s, `${PROJECT_TEMPLATE_VERSION}-next`);
    expect(next.project).not.toBe(before.project); expect(next.pages.login).not.toBe(before.pages.login);
    s.project.projectId = 'copy'; s.projectId = 'copy'; s.plan = compileProjectTickets(s.project);
    expect(projectGenerationFingerprints(s).pages.login).not.toBe(before.pages.login);
  });
  it('includes verified asset bytes only in consuming page closures', () => {
    const p = project(); (p.pages.resetPassword.nodes.root as FrameNode).background = [{ type: 'image', src: 'assets/a.svg', fit: 'cover' }];
    const s = snapshot(p); const bytes = (color: string) => new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg"><path fill="${color}" /></svg>`);
    s.assets = [createProjectAssetSnapshot('assets/a.svg', bytes('red'))];
    const before = projectGenerationFingerprints(s);
    s.assets = [createProjectAssetSnapshot('assets/a.svg', bytes('blue'))];
    const after = projectGenerationFingerprints(s);
    expect(after.pages.login).not.toBe(before.pages.login); expect(after.pages.dashboard).toBe(before.pages.dashboard);
    s.assets[0].sha256 = '0'.repeat(64); expect(() => projectGenerationFingerprints(s)).toThrow();
  });
  it('rejects invalid references in excluded widget screens as well', () => {
    const p = project(); p.pages.widget = structuredClone(p.pages.login); p.pages.widget.kind = 'widget'; p.pageOrder.push('widget');
    const s = snapshot(p);
    (p.pages.widget.nodes.loginButton as ButtonNode).action = { type: 'navigate', target: 'missing' };
    expect(() => projectGenerationFingerprints(s)).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { validateProjectSpec, type FrameNode, type ProjectSpec, type TextNode } from '@/features/editor/schema';
import { compileProjectTickets, validateProjectPlanContext } from '@/features/editor/ticket/compileProjectTickets';
import { buildProjectInputSnapshot, createProjectAssetSnapshot, projectAssetPaths } from '@/features/editor/ticket/projectInputSnapshot';
import { buildProjectTicketRequest, parseProjectTicketResponse, validateProjectTicketRequest } from '@/features/editor/ticket/projectTicketProtocol';
import { PROJECT_TEMPLATE_VERSION, projectGenerationFingerprints } from '@/features/editor/export/projectGenerationIdentity';
import { inspectProjectGeneration, projectProvenanceContext, type ProjectGenerationProvenance } from '@/features/editor/export/projectGenerationProvenance';
import { sha256Hex } from '@/features/editor/export/contentHash';
import { ticketComponentKey } from '@/features/editor/export/generationIdentity';
import type { GenerationManifest } from '@/features/editor/export/generationManifest';
import fixture from './fixtures/screen-relations-project.json';
import sharedExample from '../examples/shared-widget-project.json';

function project() {
  const p = { ...structuredClone(fixture) as unknown as ProjectSpec, projectId: 'shared-project' };
  p.pages.shared = structuredClone(p.pages.login);
  p.pages.shared.kind = 'widget';
  p.pages.shared.name = 'Shared';
  p.pageOrder.push('shared');
  const instance = { type: 'instance' as const, name: 'Shared instance', box: { width: 100, height: 80 }, ref: 'shared', overrides: {} };
  p.pages.login.nodes.sharedOne = instance;
  (p.pages.login.nodes.root as FrameNode).children.push({ node: 'sharedOne' });
  p.pages.dashboard.nodes.sharedTwo = structuredClone(instance);
  (p.pages.dashboard.nodes.root as FrameNode).children.push({ node: 'sharedTwo' });
  return p;
}
const snapshot = (p: ProjectSpec) => buildProjectInputSnapshot('wave', p, compileProjectTickets(p), []);

describe('project v5 shared widget generation boundary', () => {
  it('ships a valid two-page shared widget example planned as one component', () => {
    const p = sharedExample as unknown as ProjectSpec;
    expect(validateProjectSpec(p).valid).toBe(true);
    const plan = compileProjectTickets(p);
    const root = plan.tickets.filter(ticket => ticket.widgetRoot);
    expect(root).toHaveLength(1);
    expect(root[0].sourcePageId).toBe('notificationWidget');
    for (const source of ['login', 'dashboard']) {
      expect(plan.tickets.some(ticket => ticket.sourcePageId === source && ticket.dependsOn.includes(root[0].id))).toBe(true);
    }
  });
  it('plans one shared root with cross-screen dependencies and versioned response', () => {
    const p = project(); const plan = compileProjectTickets(p);
    expect(validateProjectPlanContext(plan, p).valid).toBe(true);
    const roots = plan.tickets.filter(ticket => ticket.widgetRoot);
    expect(roots).toHaveLength(1);
    const root = roots[0];
    expect(root).toMatchObject({ sourcePageId: 'shared', kind: 'component', instances: ['root'] });
    for (const source of ['login', 'dashboard']) expect(plan.tickets.some(ticket => ticket.sourcePageId === source && ticket.dependsOn.includes(root.id))).toBe(true);
    for (const ticket of plan.tickets) if (root.dependsOn.includes(ticket.id)) ticket.status = 'done';
    const input = buildProjectInputSnapshot('wave', p, plan, []);
    const request = buildProjectTicketRequest({ requestId: 'wave', projectRoot: 'output', snapshotContent: input.content, snapshotSha256: input.sha256, ticketIds: [root.id] });
    expect(request.protocol).toBe(5);
    expect(request.tickets[0].filePath).toBe('output/shared/components/Shared.tsx');
    expect(validateProjectTicketRequest(request, input.content, 'output').valid).toBe(true);
    expect(validateProjectTicketRequest({ ...request, protocol: 4 }, input.content, 'output')).toMatchObject({ valid: false, code: 'version-mismatch' });
    const results = [{ ticketId: root.id, status: 'done' }];
    expect(parseProjectTicketResponse(JSON.stringify({ protocol: 5, requestId: 'wave', results }), request).kind).toBe('results');
    expect(parseProjectTicketResponse(JSON.stringify({ protocol: 4, requestId: 'wave', results }), request)).toMatchObject({ kind: 'malformed', code: 'version-mismatch' });
  });

  it('tracks shared source edits and asset bytes in each host closure', () => {
    const p = project();
    (p.pages.shared.nodes.root as FrameNode).background = [{ type: 'image', src: 'assets/shared.svg', fit: 'cover' }];
    const image = (color: string) => createProjectAssetSnapshot('assets/shared.svg', new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg"><path fill="${color}"/></svg>`));
    const plan = compileProjectTickets(p);
    const make = (color: string) => ({ protocol: 1 as const, requestId: 'wave', projectId: p.projectId!, project: p, plan, assets: [image(color)] });
    expect(projectAssetPaths(p)).toEqual(['assets/shared.svg']);
    const before = projectGenerationFingerprints(make('red'));
    const after = projectGenerationFingerprints(make('blue'));
    expect(before.closures.login).toContain('shared');
    for (const source of ['login', 'dashboard', 'shared']) expect(after.pages[source]).not.toBe(before.pages[source]);
    const original = projectGenerationFingerprints(make('red'));
    (p.pages.shared.nodes.title as TextNode).content += '!';
    const edited = projectGenerationFingerprints({ ...make('red'), plan: compileProjectTickets(p) });
    for (const source of ['login', 'dashboard', 'shared']) expect(edited.pages[source]).not.toBe(original.pages[source]);
  });

  it('accepts complete v5 historical provenance with one widget output', () => {
    const p = project(); const input = snapshot(p);
    const parsed = JSON.parse(input.content);
    const context = projectProvenanceContext(parsed, 'output');
    const files = new Map(context.outputs.map(output => [output.filePath, new TextEncoder().encode(`// ${output.id}`)]));
    const record: ProjectGenerationProvenance = { protocol: 1, projectId: p.projectId!, projectRoot: 'output', plan: context.snapshot.plan,
      templateVersion: PROJECT_TEMPLATE_VERSION, inputFingerprint: context.fingerprints.project,
      assets: [], committedRunId: 'run', outputs: context.outputs.map(output => ({ ...output, requestId: 'wave', sha256: sha256Hex(files.get(output.filePath)!) })) };
    const manifest: GenerationManifest = { protocol: 2, projects: { [p.projectId!]: { outputDir: 'output', fileName: null, createdAt: 'now' } }, entries: {} };
    for (const output of record.outputs.filter(output => output.scope === 'page')) {
      const ticket = context.snapshot.plan.tickets.find(ticket => ticket.id === output.id)!;
      manifest.entries[output.filePath] = { projectId: p.projectId!, pageId: output.sourcePageId!, componentName: ticket.componentName,
        componentKey: ticketComponentKey(ticket), ticketId: ticket.id, requestId: 'wave', ticketProtocol: 5,
        inputScope: 'page', inputFingerprint: output.inputFingerprint, contentHash: `sha256:${output.sha256}`, acceptedAt: 'now' };
    }
    const inspect = () => inspectProjectGeneration({ text: JSON.stringify(record), context, files, manifest });
    expect(inspect()).toMatchObject({ state: 'current', missingIds: [] });
    const widget = record.outputs.find(output => output.sourcePageId === 'shared')!;
    manifest.entries[widget.filePath].ticketProtocol = 4;
    expect(inspect().state).toBe('unverified');
  });
});

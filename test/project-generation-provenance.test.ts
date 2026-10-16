import { describe, expect, it } from "vitest";
import type { ProjectSpec } from "@/features/editor/schema";
import { compileProjectTickets } from "@/features/editor/ticket/compileProjectTickets";
import type { ProjectInputSnapshot } from "@/features/editor/ticket/projectInputSnapshot";
import { PROJECT_TEMPLATE_VERSION } from "@/features/editor/export/projectGenerationIdentity";
import { inspectProjectGeneration, projectProvenanceContext, type ProjectGenerationProvenance } from "@/features/editor/export/projectGenerationProvenance";
import { sha256Hex } from "@/features/editor/export/contentHash";
import { ticketComponentKey } from "@/features/editor/export/generationIdentity";
import type { GenerationManifest } from "@/features/editor/export/generationManifest";
import fixture from "./fixtures/screen-relations-project.json";
function setup() {
  const project = { ...structuredClone(fixture) as unknown as ProjectSpec, projectId: 'owner' };
  const snapshot: ProjectInputSnapshot = { protocol: 1, requestId: 'wave', projectId: 'owner', project, plan: compileProjectTickets(project), assets: [] };
  const context = projectProvenanceContext(snapshot, 'output');
  const files = new Map(context.outputs.map(output => [output.filePath, new TextEncoder().encode(`// ${output.id}`)]));
  const record: ProjectGenerationProvenance = { protocol: 1, projectId: 'owner', projectRoot: 'output', plan: snapshot.plan,
    templateVersion: PROJECT_TEMPLATE_VERSION, inputFingerprint: context.fingerprints.project, assets: [], committedRunId: 'run',
    outputs: context.outputs.map(output => ({ ...output, requestId: 'wave', sha256: sha256Hex(files.get(output.filePath)!) })) };
  const manifest: GenerationManifest = { protocol: 2, projects: { owner: { outputDir: 'output', fileName: null, createdAt: 'now' } }, entries: {} };
  for (const output of record.outputs.filter(output => output.scope === 'page')) {
    const ticket = snapshot.plan.tickets.find(ticket => ticket.id === output.id)!;
    manifest.entries[output.filePath] = { projectId: 'owner', pageId: output.sourcePageId!, componentName: ticket.componentName,
      componentKey: ticketComponentKey(ticket), ticketId: ticket.id, requestId: 'wave', ticketProtocol: 4,
      inputScope: 'page', inputFingerprint: output.inputFingerprint, contentHash: `sha256:${output.sha256}`, acceptedAt: 'now' };
  }
  const inspect = (text: string | null = JSON.stringify(record)) => inspectProjectGeneration({ text, context, files, manifest });
  return { snapshot, context, record, files, manifest, inspect };
}
describe('project provenance read boundary', () => {
  it('requires the complete page/artifact output set for current', () => {
    const s = setup(); expect(s.inspect()).toMatchObject({ state: 'current', missingIds: [] });
    const removed = s.record.outputs.pop()!;
    expect(s.inspect()).toMatchObject({ state: 'partial', missingIds: [removed.id] });
    s.record.outputs = []; expect(s.inspect().state).toBe('partial');
  });
  it.each([null, '{broken', '{}', '{"protocol":99}'])('preserves unverified input %j without writing', text => {
    const s = setup(); const before = structuredClone(s.record); const files = [...s.files];
    expect(s.inspect(text).state).toBe('unverified'); expect(s.record).toEqual(before); expect([...s.files]).toEqual(files);
  });
  it.each(['extra', 'duplicate', 'missing-source', 'artifact-source', 'outside', 'wrong-owner', 'wrong-plan-owner', 'bad-asset'])('rejects closed-shape/ownership violation %s', kind => {
    const s = setup(); const value = JSON.parse(JSON.stringify(s.record));
    if (kind === 'extra') value.extra = true;
    if (kind === 'duplicate') value.outputs.push(value.outputs[0]);
    if (kind === 'missing-source') delete value.outputs[0].sourcePageId;
    if (kind === 'artifact-source') value.outputs.at(-1).sourcePageId = 'login';
    if (kind === 'outside') value.outputs[0].filePath = '../outside.tsx';
    if (kind === 'wrong-owner') value.projectRoot = 'other';
    if (kind === 'wrong-plan-owner') value.plan.projectId = 'other';
    if (kind === 'bad-asset') value.assets = [{}];
    expect(s.inspect(JSON.stringify(value)).state).toBe('unverified');
  });
  it('rejects changed or missing bytes and old-GUI manifest changes', () => {
    const s = setup(); const path = s.record.outputs[0].filePath;
    s.files.set(path, new TextEncoder().encode('manual edit')); expect(s.inspect().state).toBe('unverified');
    s.files.delete(path); expect(s.inspect().state).toBe('unverified');
    const t = setup(); t.manifest.entries[path].ticketProtocol = 3; expect(t.inspect().state).toBe('unverified');
    delete t.manifest.entries[path]; expect(t.inspect().state).toBe('unverified');
  });
  it('does not derive missing fingerprints from current project', () => {
    const s = setup(); s.record.inputFingerprint = '0'.repeat(64);
    expect(s.inspect().state).toBe('stale'); expect(s.record.inputFingerprint).toBe('0'.repeat(64));
    const t = setup(); t.record.templateVersion = 'older'; expect(t.inspect().state).toBe('stale');
  });
  it('ignores execution progress only, preserving structural plan equality', () => {
    const s = setup(); const value = structuredClone(s.record); value.plan.tickets[0].status = 'failed'; value.plan.tickets[0].error = 'retry';
    expect(s.inspect(JSON.stringify(value)).state).toBe('current');
    value.plan.entryPageId = 'dashboard'; expect(s.inspect(JSON.stringify(value)).state).toBe('stale');
  });
});

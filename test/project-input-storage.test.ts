import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FrameNode, ProjectSpec } from "@/features/editor/schema";
import { compileProjectTickets } from "@/features/editor/ticket/compileProjectTickets";
import { sha256Hex } from "@/features/editor/export/contentHash";
const io = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("@/features/editor/ui/workspaceClient", () => ({ readWorkspaceFileSnapshot: io.read, writeWorkspaceFile: io.write }));
import { prepareStoredProjectRequest } from "@/features/editor/ui/projectInputStorage";
import fixture from "./fixtures/screen-relations-project.json";
let disk: Map<string, Uint8Array>;
const text = (value: string) => new TextEncoder().encode(value);
function args() {
  const project = { ...structuredClone(fixture) as unknown as ProjectSpec, projectId: 'stored' };
  (project.pages.login.nodes.root as FrameNode).background = [{ type: 'image', src: 'assets/a.svg', fit: 'cover' }];
  const plan = compileProjectTickets(project);
  return { requestId: 'request', project, plan, projectRoot: 'owned', ticketIds: plan.tickets.filter(t => !t.dependsOn.length).map(t => t.id), isCurrent: () => true };
}
beforeEach(() => {
  disk = new Map([['assets/a.svg', text('<svg xmlns="http://www.w3.org/2000/svg" />')]]);
  io.read.mockReset().mockImplementation(async (path: string) => { const bytes = disk.get(path); return { ok: true, snapshot: bytes ? { bytes, revision: sha256Hex(bytes) } : null }; });
  io.write.mockReset().mockImplementation(async (path: string, content: string, _type: string, expected: string) => {
    expect(expected).toBe('missing');
    if (disk.has(path)) return { ok: false, status: 409, error: 'exists' };
    disk.set(path, text(content)); return { ok: true, revision: sha256Hex(text(content)) };
  });
});
describe('project immutable input storage', () => {
  it('reads assets then create-only saves and rereads before returning a request', async () => {
    const a = args(); const original = structuredClone(a.project);
    const result = await prepareStoredProjectRequest(a);
    expect(result.request.protocol).toBe(4);
    expect(io.read.mock.calls.map(call => call[0])).toEqual(['assets/a.svg', 'runtime/project-input-request.json']);
    expect(io.write.mock.calls.map(call => call[0])).toEqual(['runtime/project-input-request.json']);
    expect(a.project).toEqual(original); expect(a.plan.tickets.every(t => t.status === 'pending')).toBe(true);
  });
  it('accepts a collision only after exact readback and never overwrites', async () => {
    const first = await prepareStoredProjectRequest(args());
    const second = await prepareStoredProjectRequest(args()); expect(second.snapshot).toEqual(first.snapshot);
    disk.set(first.snapshot.path, text('{}'));
    await expect(prepareStoredProjectRequest(args())).rejects.toThrow(/일치하지/);
    expect(new TextDecoder().decode(disk.get(first.snapshot.path))).toBe('{}');
  });
  it.each(['missing', 'read-error', 'invalid-bytes'])('fails before writing for asset %s', async kind => {
    if (kind === 'missing') disk.clear();
    if (kind === 'read-error') io.read.mockResolvedValue({ ok: false });
    if (kind === 'invalid-bytes') disk.set('assets/a.svg', text('not image'));
    await expect(prepareStoredProjectRequest(args())).rejects.toThrow(); expect(io.write).not.toHaveBeenCalled();
  });
  it('does not certify a success response whose stored bytes differ', async () => {
    io.write.mockImplementation(async (path: string) => { disk.set(path, text('{}')); return { ok: true }; });
    await expect(prepareStoredProjectRequest(args())).rejects.toThrow(/일치하지/);
  });
  it('does not convert transport failure to success by inspecting existing files', async () => {
    await prepareStoredProjectRequest(args()); io.read.mockClear();
    io.write.mockResolvedValue({ ok: false, error: 'lost response' });
    await expect(prepareStoredProjectRequest(args())).rejects.toThrow(/저장에 실패/);
    expect(io.read.mock.calls.map(call => call[0])).toEqual(['assets/a.svg']);
  });
  it('rejects cancellation before I/O and after an asset read', async () => {
    await expect(prepareStoredProjectRequest({ ...args(), isCurrent: () => false })).rejects.toThrow(/취소/);
    expect(io.read).not.toHaveBeenCalled();
    const a = args(); let current = true; a.isCurrent = () => current;
    io.read.mockImplementation(async () => { current = false; return { ok: false }; });
    await expect(prepareStoredProjectRequest(a)).rejects.toThrow(/취소/); expect(io.write).not.toHaveBeenCalled();
  });
  it('cancellation during storage leaves input only and returns no dispatch request', async () => {
    const a = args(); let current = true; a.isCurrent = () => current;
    io.write.mockImplementation(async (path: string, content: string) => { disk.set(path, text(content)); current = false; return { ok: true }; });
    await expect(prepareStoredProjectRequest(a)).rejects.toThrow(/취소/);
    expect([...disk.keys()]).toEqual(['assets/a.svg', 'runtime/project-input-request.json']);
  });
  it('captures document and wave values before awaiting asset I/O', async () => {
    const a = args(); const read = io.read.getMockImplementation()!;
    io.read.mockImplementation(async (...params: unknown[]) => { a.project.name = 'edited'; a.projectRoot = 'changed'; a.ticketIds.length = 0; return read(...params); });
    const result = await prepareStoredProjectRequest(a);
    expect(result.request.project.name).not.toBe('edited'); expect(result.request.projectRoot).toBe('owned'); expect(result.request.tickets.length).toBeGreaterThan(0);
  });
  it('rejects invalid waves before writing an input file', async () => {
    await expect(prepareStoredProjectRequest({ ...args(), ticketIds: ['project:host'] })).rejects.toThrow(); expect(io.write).not.toHaveBeenCalled();
  });
});

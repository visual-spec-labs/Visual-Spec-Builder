import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSpec } from '@/features/editor/schema';
import { sha256Hex } from '@/features/editor/export/contentHash';
import { compileProjectTickets } from '@/features/editor/ticket/compileProjectTickets';
import { requestProjectTicketBatch } from '@/features/editor/ticket/ticketAgentClient';
import { createAgentRequestWait, AGENT_WAIT_WINDOW_MS } from '@/features/editor/ui/agentRequestWait';
import { TICKET_REQUEST_PATH, TICKET_RESPONSE_PATH } from '@/features/editor/ticket/ticketProtocol';
import fixture from './fixtures/screen-relations-project.json';
const io = vi.hoisted(() => ({ disk: new Map<string,string>(), events: [] as string[], hold: vi.fn(), renew: vi.fn(), release: vi.fn(), read: vi.fn(), write: vi.fn(), beforeRead: vi.fn() }));
vi.mock('@/features/editor/ui/agentRequestLock', () => ({ holdRequestLock: io.hold }));
vi.mock('@/features/editor/ui/workspaceClient', () => ({
  readWorkspaceFileSnapshot: io.read, writeWorkspaceFile: io.write,
  listWorkspaceFiles: async (dir: string) => [...io.disk.keys()].filter(p => p.startsWith(dir+'/')).map(p => p.slice(dir.length+1)),
  readWorkspaceTextFile: async (path: string) => { if(await io.beforeRead() === null)return null; return io.disk.get(path) ?? null; },
  // 티켓 임시 출력 증거 확인(#432 리뷰 대응)만 쓴다 — `beforeRead`는 응답 파일 읽기 전용이라 여기선 안 거친다.
  readWorkspaceTextFileStrict: async (path: string) => ({ ok: true, text: io.disk.get(path) ?? null }),
}));
function input() {
  const project = {...structuredClone(fixture) as unknown as ProjectSpec, projectId:'dispatch'};
  const plan = compileProjectTickets(project);
  return {requestId:'wave',project,plan,projectRoot:'owned',ticketIds:plan.tickets.filter(t => !t.dependsOn.length).map(t => t.id),isCurrent:()=>true};
}
function response(protocol = 4, ids?: string[]) {
  const request = JSON.parse(io.disk.get(TICKET_REQUEST_PATH)!);
  io.disk.set(TICKET_RESPONSE_PATH, JSON.stringify({protocol,requestId:request.id,results:(ids ?? request.tickets.map((t:{id:string})=>t.id)).map((ticketId:string)=>({ticketId,status:'done'}))}));
}
beforeEach(() => {
  vi.useFakeTimers(); io.disk.clear(); io.events=[];
  io.renew.mockReset().mockResolvedValue(true); io.release.mockReset(); io.beforeRead.mockReset();
  io.hold.mockReset().mockImplementation(async ()=>{io.events.push('lock'); return {renew:io.renew,release:io.release};});
  io.write.mockReset().mockImplementation(async (path:string,body:string,_mime:string,expected?:string,owner?:string)=>{
    io.events.push('write:'+path);
    if(path===TICKET_REQUEST_PATH) expect(owner).toBe('wave'); else expect(expected).toBe('missing');
    io.disk.set(path,body);return {ok:true};
  });
  io.read.mockReset().mockImplementation(async (path:string)=>{io.events.push('read:'+path);const content=io.disk.get(path);const bytes=content===undefined?null:new TextEncoder().encode(content);return {ok:true,snapshot:bytes?{bytes,revision:sha256Hex(bytes)}:null};});
});
afterEach(()=>vi.useRealTimers());
describe('project v4 dispatch under the shared request lease',()=>{
  it('stores and verifies immutable input before compact dispatch and transfers the response lease',async()=>{
    const args=input(); const cancel={cancelled:false}; const original=structuredClone(args.project);
    const pending=requestProjectTicketBatch(args,cancel); args.project.name='edited after dispatch'; args.ticketIds=[];
    await vi.advanceTimersByTimeAsync(0);
    expect(io.events).toEqual(['lock','write:runtime/project-input-wave.json','read:runtime/project-input-wave.json','write:'+TICKET_REQUEST_PATH]);
    const body=io.disk.get(TICKET_REQUEST_PATH)!;const request=JSON.parse(body);
    expect(body).toBe(JSON.stringify(request));expect(request.protocol).toBe(4);expect(request.project).toEqual(original);
    response();await vi.advanceTimersByTimeAsync(1000);const outcome=await pending;
    expect(outcome.kind).toBe('response');expect(io.release).not.toHaveBeenCalled();
    if(outcome.kind==='response'){expect(outcome.result.kind).toBe('results');expect(outcome.prepared.request.project).toEqual(original);expect(outcome.prepared.snapshot.content).toBe(io.disk.get('runtime/project-input-wave.json'));outcome.lock.release();}
    expect(io.release).toHaveBeenCalledOnce();
  });
  it.each(['busy','unavailable'])('does not prepare or write without an available lease: %s',async state=>{
    io.hold.mockResolvedValue(state);expect((await requestProjectTicketBatch(input(),{cancelled:false})).kind).toBe(state);
    expect(io.write).not.toHaveBeenCalled();expect(io.read).not.toHaveBeenCalled();
  });
  it('rejects failed snapshot readback before publishing and releases the lock',async()=>{
    io.read.mockResolvedValue({ok:true,snapshot:null});
    expect((await requestProjectTicketBatch(input(),{cancelled:false})).kind).toBe('writeFailed');
    expect(io.disk.has(TICKET_REQUEST_PATH)).toBe(false);expect(io.release).toHaveBeenCalledOnce();
  });
  it('checks lease ownership again after storage and before dispatch',async()=>{
    io.renew.mockResolvedValue(false);
    expect((await requestProjectTicketBatch(input(),{cancelled:false})).kind).toBe('lockLost');
    expect(io.disk.has(TICKET_REQUEST_PATH)).toBe(false);expect(io.release).toHaveBeenCalledOnce();
  });
  it('cancellation during immutable storage leaves no published request',async()=>{
    const cancel={cancelled:false};const write=io.write.getMockImplementation()!;
    io.write.mockImplementation(async(...args:unknown[])=>{const result=await write(...args);cancel.cancelled=true;return result;});
    expect((await requestProjectTicketBatch(input(),cancel)).kind).toBe('cancelled');
    expect(io.disk.has(TICKET_REQUEST_PATH)).toBe(false);expect(io.release).toHaveBeenCalledOnce();
  });
  it.each([3,5])('rejects a matching response using protocol %s without fallback',async protocol=>{
    const pending=requestProjectTicketBatch(input(),{cancelled:false});await vi.advanceTimersByTimeAsync(0);response(protocol);await vi.advanceTimersByTimeAsync(1000);
    const outcome=await pending;expect(outcome).toMatchObject({kind:'response',result:{kind:'malformed',code:'version-mismatch'}});
    if(outcome.kind==='response')outcome.lock!.release();
  });
  it('does not accept results after the document generation changes during GET',async()=>{
    const args=input();let current=true;args.isCurrent=()=>current;
    const pending=requestProjectTicketBatch(args,{cancelled:false});await vi.advanceTimersByTimeAsync(0);response();
    io.beforeRead.mockImplementation(()=>{current=false;});await vi.advanceTimersByTimeAsync(1000);
    expect((await pending).kind).toBe('cancelled');expect(io.release).toHaveBeenCalledOnce();
  });
  it('rejects omitted results from a matching wave',async()=>{
    const pending=requestProjectTicketBatch(input(),{cancelled:false});await vi.advanceTimersByTimeAsync(0);response(4,[]);await vi.advanceTimersByTimeAsync(1000);
    const outcome=await pending;expect(outcome).toMatchObject({kind:'response',result:{kind:'malformed',code:'missing-ticket'}});
    if(outcome.kind==='response')outcome.lock!.release();
  });
  it('keeps waiting after a transient null response read and retries the same request',async()=>{
    let settled=false;const pending=requestProjectTicketBatch(input(),{cancelled:false}).then(result=>{settled=true;return result;});
    await vi.advanceTimersByTimeAsync(0);response();io.beforeRead.mockResolvedValueOnce(null);
    await vi.advanceTimersByTimeAsync(1000);expect(settled).toBe(false);expect(io.release).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);const outcome=await pending;
    expect(outcome).toMatchObject({kind:'response',result:{kind:'results'}});if(outcome.kind==='response')outcome.lock.release();
  });
  it('a persistently unreadable listed response times out instead of becoming malformed',async()=>{
    const pending=requestProjectTicketBatch(input(),{cancelled:false});await vi.advanceTimersByTimeAsync(0);response();io.beforeRead.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(AGENT_WAIT_WINDOW_MS+1000);
    expect(await pending).toMatchObject({kind:'timeout'});expect(io.release).toHaveBeenCalledOnce();
  });
  it('settles timeout with v4 guidance and releases the lease',async()=>{
    const wait=createAgentRequestWait();const pending=requestProjectTicketBatch(input(),{cancelled:false},wait);
    await vi.advanceTimersByTimeAsync(AGENT_WAIT_WINDOW_MS+1000);expect(await pending).toMatchObject({kind:'timeout',message:expect.stringContaining('v4')});
    expect(wait.extend()).toBe(false);expect(io.release).toHaveBeenCalledOnce();
  });
});

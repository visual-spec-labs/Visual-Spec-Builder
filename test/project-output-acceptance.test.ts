import { findPendingProjectRecovery } from '@/features/editor/ui/projectPendingRecovery';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSpec } from '@/features/editor/schema';
import { compileProjectTickets } from '@/features/editor/ticket/compileProjectTickets';
import { buildProjectInputSnapshot, projectAssetPaths, createProjectAssetSnapshot } from '@/features/editor/ticket/projectInputSnapshot';
import { buildProjectTicketRequest } from '@/features/editor/ticket/projectTicketProtocol';
import { sha256Hex } from '@/features/editor/export/contentHash';
import { GENERATION_MANIFEST_PATH, parseGenerationManifest } from '@/features/editor/export/generationManifest';
import { planProjectOutputs, commitProjectOutputs, restoreProjectOutputs } from '@/features/editor/ui/projectOutputAcceptance';
import { readProjectGenerationEvidence } from '@/features/editor/ui/projectGenerationWorkspace';
import fixture from './fixtures/screen-relations-project.json';
const io=vi.hoisted(()=>({disk:new Map<string,Uint8Array>(),writes:[] as string[],current:true,lease:true,hook:vi.fn(),failPath:'',rejectFence:false}));
const encode=(text:string)=>new TextEncoder().encode(text);
vi.mock('@/features/editor/ui/agentRequestLock',()=>({holdRequestLock:async()=>({renew:async()=>io.lease,release:()=>{io.lease=false;}})}));
vi.mock('@/features/editor/ui/workspaceClient',()=>({
  readWorkspaceFileSnapshot:async(path:string)=>({ok:true,snapshot:io.disk.has(path)?{bytes:io.disk.get(path)!.slice(),revision:sha256Hex(io.disk.get(path)!)}:null}),
  writeWorkspaceFile:async(path:string,body:string|ArrayBuffer,_mime:string,expected?:string,owner?:string)=>{
    if(io.rejectFence&&path.includes('runtime/project-generation-')&&typeof body==='string'&&JSON.parse(body).phase==='pending'){io.lease=false;return {ok:false,status:409,error:'lease expired before fence'};}
    if(owner&&!io.lease)return {ok:false,status:409,error:'lease'};
    if(path===io.failPath)return {ok:false,status:500,error:'injected'};
    const current=io.disk.get(path);if(expected!==undefined&&expected!==(current?sha256Hex(current):'missing'))return {ok:false,status:409,error:'CAS'};
    io.disk.set(path,typeof body==='string'?encode(body):new Uint8Array(body));io.writes.push(path);await io.hook(path);
    return {ok:true,path};
  },
  deleteWorkspaceFile:async(path:string,expected:string)=>{
    if(path===io.failPath)return {ok:false,status:500,error:'injected'};
    const current=io.disk.get(path);if(!io.lease||!current||sha256Hex(current)!==expected)return {ok:false,status:409,error:'CAS/lease'};
    io.disk.delete(path);await io.hook(path);return {ok:true,path};
  },
}));
const lock={renew:async()=>io.lease,release:()=>{io.lease=false;}};
const text=(path:string)=>new TextDecoder().decode(io.disk.get(path));
function setup(id='wave') {
  const project={...structuredClone(fixture) as unknown as ProjectSpec,projectId:'owner'};
  const plan=compileProjectTickets(project);return prepare(id,project,plan);
}
function prepare(id:string,project:ProjectSpec,plan:ReturnType<typeof compileProjectTickets>) {
  const snapshot=buildProjectInputSnapshot(id,project,plan,projectAssetPaths(project).map(path=>createProjectAssetSnapshot(path,io.disk.get(path)!)));
  const ticketIds=plan.tickets.filter(t=>t.status!=='done'&&t.dependsOn.every(dep=>plan.tickets.find(t=>t.id===dep)?.status==='done')).map(t=>t.id);
  const request=buildProjectTicketRequest({requestId:id,projectRoot:'owned',snapshotContent:snapshot.content,snapshotSha256:snapshot.sha256,ticketIds});
  io.disk.set(snapshot.path,encode(snapshot.content));
  for(const ticket of request.tickets)io.disk.set(ticket.outputPath,encode(`export default function ${ticket.componentName}(){return <div/>}`));
  return {prepared:{request,snapshot},results:request.tickets.map(t=>({ticketId:t.id,status:'done' as const})),runId:id+'-run',isCurrent:()=>io.current};
}
beforeEach(()=>{
  io.disk.clear();io.writes=[];io.current=true;io.lease=true;io.hook.mockReset();io.failPath='';io.rejectFence=false;
  io.disk.set(GENERATION_MANIFEST_PATH,encode(JSON.stringify({protocol:2,projects:{owner:{fileName:null,outputDir:'owned',createdAt:'now'}},entries:{}})));
});
describe('atomic project wave acceptance',()=>{
  it('records partial waves then GUI artifacts without fictitious page entries',async()=>{
    let args=setup();let complete=false;
    for(let index=0;index<10;index++) {
      const plan=await planProjectOutputs(args);
      const result=await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});expect(result.committed).toBe(true);
      const record=JSON.parse(text(plan.evidence.sidecarPath));const manifest=parseGenerationManifest(text(GENERATION_MANIFEST_PATH));
      const evidence=await readProjectGenerationEvidence(plan.context);
      expect(evidence.inspection.state).toBe(record.outputs.length===plan.context.outputs.length?'current':'partial');
      for(const artifact of record.outputs.filter((output:{scope:string})=>output.scope==='project'))expect(manifest.entries[artifact.filePath]).toBeUndefined();
      const order=io.writes.filter(path=>path.startsWith('generated/')||path===GENERATION_MANIFEST_PATH||path===plan.evidence.sidecarPath);
      expect(order.at(-1)).toBe(plan.evidence.sidecarPath);
      if(evidence.inspection.state==='current'){complete=true;break;}
      const next=structuredClone(args.prepared.request.plan);for(const ticket of next.tickets)if(record.outputs.some((output:{id:string})=>output.id===ticket.id))ticket.status='done';
      args=prepare(`wave${index+1}`,args.prepared.request.project,next);
    }
    expect(complete).toBe(true);
  });
  it('keeps all generated files unchanged when one review decision is keep',async()=>{
    const args=setup();const first=args.prepared.request.tickets[0];io.disk.set('generated/'+first.filePath,encode('manual'));
    const plan=await planProjectOutputs(args);const before=[...io.disk];
    const result=await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});
    expect(result.committed).toBe(false);expect([...io.disk]).toEqual(before);expect(io.writes).toEqual([]);
  });
  it.each(['output','manifest','sidecar'])('compensates cancellation after %s mutation under the original lease',async stage=>{
    const args=setup();const plan=await planProjectOutputs(args);const manifestBefore=text(GENERATION_MANIFEST_PATH);
    io.hook.mockImplementation((path:string)=>{if((stage==='output'&&path.startsWith('generated/'))||(stage==='manifest'&&path===GENERATION_MANIFEST_PATH)||(stage==='sidecar'&&path===plan.evidence.sidecarPath&&io.disk.has(path)&&JSON.parse(text(path)).protocol===1))io.current=false;});
    const result=await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});
    expect(result).toMatchObject({committed:false,recoveryRequired:false});
    expect([...io.disk.keys()].filter(path=>path.startsWith('generated/'))).toEqual([]);
    expect(io.disk.has(plan.evidence.sidecarPath)).toBe(false);expect(text(GENERATION_MANIFEST_PATH)).toBe(manifestBefore);
  });
  it('preserves unresolved output when the lease is lost rather than acquiring a new rollback authority',async()=>{
    const args=setup();const plan=await planProjectOutputs(args);
    io.hook.mockImplementation((path:string)=>{if(path.startsWith('generated/'))io.lease=false;});
    const result=await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});
    expect(result).toMatchObject({committed:false,recoveryRequired:true});
    expect([...io.disk.keys()].some(path=>path.startsWith('generated/'))).toBe(true);
    expect(JSON.parse(text(`backups/${plan.runId}/run.json`)).phase).toBe('recovery');
  });
  it('rolls back outputs when sidecar write fails',async()=>{
    const args=setup();const plan=await planProjectOutputs(args);io.failPath=plan.evidence.sidecarPath;
    expect(await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent})).toMatchObject({committed:false,recoveryRequired:false});
    expect([...io.disk.keys()].filter(path=>path.startsWith('generated/'))).toEqual([]);
  });
  it('does not roll back after the commit point when Stop arrives during run bookkeeping',async()=>{
    const args=setup();const plan=await planProjectOutputs(args);
    io.hook.mockImplementation((path:string)=>{if(path===`backups/${plan.runId}/run.json`)io.current=false;});
    expect(await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent})).toMatchObject({committed:true,recoveryRequired:false});
    expect((await readProjectGenerationEvidence(plan.context)).inspection.state).toBe('partial');
  });
  it('rejects incomplete waves and altered persisted inputs without promotion',async()=>{
    const args=setup();await expect(planProjectOutputs({...args,results:[]})).rejects.toThrow();
    io.disk.set(args.prepared.snapshot.path,encode('{}'));await expect(planProjectOutputs(args)).rejects.toThrow(/입력/);
    expect(io.writes).toEqual([]);
  });
  it('rejects generated bytes changed after review and preserves them',async()=>{
    const args=setup();const plan=await planProjectOutputs(args);const path='generated/'+plan.targets[0].path;io.disk.set(path,encode('external'));
    expect(await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent})).toMatchObject({committed:false,recoveryRequired:false});
    expect(text(path)).toBe('external');expect(io.disk.has(plan.evidence.sidecarPath)).toBe(false);
  });
  it('rejects unsupported image URLs before planning any promotion',async()=>{
    const args=setup();io.disk.set(args.prepared.request.tickets[0].outputPath,encode('export default()=> <img src="../unknown.png"/>'));
    await expect(planProjectOutputs(args)).rejects.toThrow();expect(io.writes).toEqual([]);
  });
  it('does not authorize an external image URL from an unreferenced widget',async()=>{
    const project={...structuredClone(fixture) as unknown as ProjectSpec,projectId:'owner'};
    const root=project.pages.notificationWidget.nodes.root;
    if(root.type!=='frame')throw Error('widget root');
    root.background=[{type:'image',src:'https://example.invalid/unused.png',fit:'cover'}];
    const args=prepare('external-widget',project,compileProjectTickets(project));
    io.disk.set(args.prepared.request.tickets[0].outputPath,encode('export default()=> <img src="https://example.invalid/unused.png"/>'));
    await expect(planProjectOutputs(args)).rejects.toThrow();
    expect(io.writes).toEqual([]);
  });
  it.each(['../../../other-project/pages/Home','../../unplanned/Helper','/tmp/outside','@/private'])('rejects an import outside the project plan: %s',async source=>{
    const args=setup();io.disk.set(args.prepared.request.tickets[0].outputPath,encode(`import Other from ${JSON.stringify(source)}; export default()=> <Other/>`));
    await expect(planProjectOutputs(args)).rejects.toThrow();expect(io.writes).toEqual([]);
  });
});


describe('explicit project run restore',()=>{
  it.each(['cancel','lease'])('handles %s after the first restore mutation without claiming success',async mode=>{
    const args=setup();const plan=await planProjectOutputs(args);await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});
    io.hook.mockImplementation((path:string)=>{if(path.startsWith('generated/')){if(mode==='cancel')io.current=false;else io.lease=false;}});
    expect(await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).toMatchObject({restored:false,recoveryRequired:mode==='lease'});
    if(mode==='cancel')expect((await readProjectGenerationEvidence(plan.context)).inspection.state).toBe('partial');
    else expect(io.disk.has(plan.evidence.sidecarPath)).toBe(true);
  });
  it.each(['sidecarPath','previousSha256','writtenSha256'])('rejects altered recovery %s without mutation',async key=>{
    const args=setup();const plan=await planProjectOutputs(args);await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});
    const path=`backups/${plan.runId}/project-recovery.json`;const recovery=JSON.parse(text(path));recovery[key]='tampered';io.disk.set(path,encode(JSON.stringify(recovery)));const before=[...io.disk];
    expect(await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).toMatchObject({restored:false,recoveryRequired:true});expect([...io.disk]).toEqual(before);
  });
  it('rejects an incomplete recorded scope before restoring any accepted bytes',async()=>{
    const args=setup();const plan=await planProjectOutputs(args);await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});
    const path=`backups/${plan.runId}/run.json`;const run=JSON.parse(text(path));run.files.pop();io.disk.set(path,encode(JSON.stringify(run)));
    const before=[...io.disk];
    expect(await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).toMatchObject({restored:false,recoveryRequired:true});
    expect([...io.disk]).toEqual(before);
  });
  it('restores prior absence for outputs and sidecar, preserving the project registry',async()=>{
    const args=setup();const plan=await planProjectOutputs(args);expect((await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent})).committed).toBe(true);
    expect(await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).toMatchObject({restored:true,recoveryRequired:false});
    expect([...io.disk.keys()].filter(path=>path.startsWith('generated/'))).toEqual([]);expect(io.disk.has(plan.evidence.sidecarPath)).toBe(false);
    expect(parseGenerationManifest(text(GENERATION_MANIFEST_PATH))).toMatchObject({projects:{owner:{outputDir:'owned'}},entries:{}});
  });
  it('restores reviewed manual bytes from the exact backup',async()=>{
    const args=setup();const path=args.prepared.request.tickets[0].filePath;io.disk.set('generated/'+path,encode('original manual bytes'));
    const plan=await planProjectOutputs(args);expect((await commitProjectOutputs(plan,{[path]:'overwrite'}, {lock,isCurrent:args.isCurrent})).committed).toBe(true);
    expect((await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).restored).toBe(true);
    expect(text('generated/'+path)).toBe('original manual bytes');
  });
  it('refuses a modified current output without changing any other file',async()=>{
    const args=setup();const plan=await planProjectOutputs(args);await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});
    io.disk.set('generated/'+plan.targets[0].path,encode('new manual edit'));const before=[...io.disk];
    expect(await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).toMatchObject({restored:false,recoveryRequired:true});expect([...io.disk]).toEqual(before);
  });
  it('does not treat plan.json as recovery authority',async()=>{
    const args=setup();const plan=await planProjectOutputs(args);await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});io.disk.delete(`backups/${plan.runId}/run.json`);io.disk.delete(`backups/${plan.runId}/pending-recovery.json`);
    expect((await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).restored).toBe(false);expect(io.disk.has(plan.evidence.sidecarPath)).toBe(true);
  });
  it('refuses tampered backup bytes and keeps accepted output',async()=>{
    const args=setup();const path=args.prepared.request.tickets[0].filePath;io.disk.set('generated/'+path,encode('manual'));
    const plan=await planProjectOutputs(args);await commitProjectOutputs(plan,{[path]:'overwrite'}, {lock,isCurrent:args.isCurrent});
    io.disk.set(`backups/${plan.runId}/files/${path}`,encode('corrupted'));const before=text('generated/'+path);
    expect((await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).restored).toBe(false);expect(text('generated/'+path)).toBe(before);
  });
  it('compensates an interrupted restore back to the accepted bytes when the lease remains valid',async()=>{
    const args=setup();const plan=await planProjectOutputs(args);await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});io.failPath=plan.evidence.sidecarPath;
    expect(await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).toMatchObject({restored:false,recoveryRequired:false});
    expect((await readProjectGenerationEvidence(plan.context)).inspection.state).toBe('partial');
  });
  it('never restores an older wave over a later sidecar',async()=>{
    const args=setup();const plan=await planProjectOutputs(args);await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});
    const later=JSON.parse(text(plan.evidence.sidecarPath));later.committedRunId='newer-run';io.disk.set(plan.evidence.sidecarPath,encode(JSON.stringify(later)));const before=[...io.disk];
    expect((await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).restored).toBe(false);expect([...io.disk]).toEqual(before);
  });
});


it('compares live source bytes again before promotion without changing the document',async()=>{
  const base=setup();const project=structuredClone(base.prepared.request.project);
  const root=project.pages.login.nodes.root;
  if(root.type!=='frame')throw Error('fixture root');
  root.background=[{type:'image',src:'assets/a.svg',fit:'cover'}];
  io.disk.set('assets/a.svg',encode('<svg xmlns="http://www.w3.org/2000/svg" width="1"/>'));
  const args=prepare('assets',project,compileProjectTickets(project));const plan=await planProjectOutputs(args);
  io.disk.set('assets/a.svg',encode('<svg xmlns="http://www.w3.org/2000/svg" width="2"/>'));
  expect((await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent})).committed).toBe(false);
  expect([...io.disk.keys()].filter(path=>path.startsWith('generated/'))).toEqual([]);
  expect(io.writes).toEqual([]);
});
it('preserves the exact prior sidecar bytes, including a UTF-8 BOM, across a second wave and restore',async()=>{
  const args=setup();const first=await planProjectOutputs(args);await commitProjectOutputs(first,{}, {lock,isCurrent:args.isCurrent});
  const original=new Uint8Array([239,187,191,...io.disk.get(first.evidence.sidecarPath)!]);io.disk.set(first.evidence.sidecarPath,original);
  const record=JSON.parse(text(first.evidence.sidecarPath));const next=structuredClone(args.prepared.request.plan);
  for(const ticket of next.tickets)if(record.outputs.some((output:{id:string})=>output.id===ticket.id))ticket.status='done';
  const nextArgs=prepare('second',args.prepared.request.project,next);const second=await planProjectOutputs(nextArgs);
  expect((await commitProjectOutputs(second,{}, {lock,isCurrent:args.isCurrent})).committed).toBe(true);
  expect(io.disk.get(`backups/${second.runId}/project-generation.json`)).toEqual(original);
  expect((await restoreProjectOutputs(second.runId,second.context,args.isCurrent)).restored).toBe(true);
  expect(io.disk.get(first.evidence.sidecarPath)).toEqual(original);
});
it('reports a restore CAS conflict and preserves the intervening manual edit',async()=>{
  const args=setup();const plan=await planProjectOutputs(args);await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});
  expect(plan.targets.length).toBeGreaterThan(1);const second='generated/'+plan.targets[1].path;
  io.hook.mockImplementation((path:string)=>{if(path==='generated/'+plan.targets[0].path)io.disk.set(second,encode('intervening manual edit'));});
  expect(await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).toMatchObject({restored:false,recoveryRequired:true});
  expect(text(second)).toBe('intervening manual edit');
});

it.each(['before', 'output', 'manifest', 'sidecar'].flatMap(stage=>['change','delete'].map(mode=>({stage,mode}))))('rejects retained output $mode at $stage and preserves external bytes',async({stage,mode})=>{
  const args=setup();const first=await planProjectOutputs(args);
  expect((await commitProjectOutputs(first,{}, {lock,isCurrent:args.isCurrent})).committed).toBe(true);
  const record=JSON.parse(text(first.evidence.sidecarPath));const next=structuredClone(args.prepared.request.plan);
  for(const ticket of next.tickets)if(record.outputs.some((output:{id:string})=>output.id===ticket.id))ticket.status='done';
  const second=await planProjectOutputs(prepare('second',args.prepared.request.project,next));
  const retained='generated/'+record.outputs[0].filePath;
  expect(second.targets.some(target=>'generated/'+target.path===retained)).toBe(false);
  const manifestBefore=text(GENERATION_MANIFEST_PATH);const sidecarBefore=text(first.evidence.sidecarPath);
  const mutate=()=>{if(mode==='delete')io.disk.delete(retained);else io.disk.set(retained,encode('external edit'));};
  io.writes=[];
  if(stage==='before')mutate();
  else io.hook.mockImplementation((path:string)=>{
    if((stage==='output'&&path.startsWith('generated/'))||(stage==='manifest'&&path===GENERATION_MANIFEST_PATH)||(stage==='sidecar'&&path===first.evidence.sidecarPath&&io.disk.has(path)&&JSON.parse(text(path)).protocol===1))mutate();
  });
  expect(await commitProjectOutputs(second,{}, {lock,isCurrent:args.isCurrent})).toMatchObject({committed:false,recoveryRequired:true});
  expect(mode==='delete'?io.disk.has(retained):text(retained)).toBe(mode==='delete'?false:'external edit');
  expect(text(GENERATION_MANIFEST_PATH)).toBe(manifestBefore);expect(text(first.evidence.sidecarPath)).toBe(sidecarBefore);
  for(const target of second.targets)expect(io.disk.has('generated/'+target.path)).toBe(false);
  if(stage==='before')expect(io.writes.some(path=>path.startsWith('generated/')||path===GENERATION_MANIFEST_PATH||path===first.evidence.sidecarPath)).toBe(false);
});
it('rechecks newly written outputs after manifest before sidecar promotion',async()=>{
  const args=setup();const plan=await planProjectOutputs(args);const path='generated/'+plan.targets[0].path;
  io.hook.mockImplementation((written:string)=>{if(written===GENERATION_MANIFEST_PATH)io.disk.set(path,encode('external edit'));});
  expect(await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent})).toMatchObject({committed:false,recoveryRequired:true});
  expect(text(path)).toBe('external edit');expect(JSON.parse(text(plan.evidence.sidecarPath))).toMatchObject({protocol:2,phase:'pending'});
});

it.each(['fence','output','manifest'])('recovers an uncommitted %s failure with a fresh lease and durable fence',async stage=>{
  const args=setup();const plan=await planProjectOutputs(args);const before=text(GENERATION_MANIFEST_PATH);
  io.hook.mockImplementation((path:string)=>{if((stage==='fence'&&path===plan.evidence.sidecarPath)||(stage==='output'&&path.startsWith('generated/'))||(stage==='manifest'&&path===GENERATION_MANIFEST_PATH))io.lease=false;});
  expect(await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent})).toMatchObject({committed:false,recoveryRequired:true});
  expect(JSON.parse(text(plan.evidence.sidecarPath))).toMatchObject({protocol:2,phase:'pending',runId:plan.runId});
  await expect(planProjectOutputs(prepare('new-wave',args.prepared.request.project,args.prepared.request.plan))).rejects.toThrow(/먼저 복구/);
  io.hook.mockReset();io.lease=true;
  expect(await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).toMatchObject({restored:true,recoveryRequired:false});
  expect([...io.disk.keys()].filter(path=>path.startsWith('generated/'))).toEqual([]);
  expect(io.disk.has(plan.evidence.sidecarPath)).toBe(false);expect(text(GENERATION_MANIFEST_PATH)).toBe(before);
});
it.each(['journal','output','manifest','fence'])('preserves all bytes when pending recovery %s is altered',async mode=>{
  const args=setup();const plan=await planProjectOutputs(args);
  io.hook.mockImplementation((path:string)=>{if(path===GENERATION_MANIFEST_PATH)io.lease=false;});
  expect((await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent})).recoveryRequired).toBe(true);
  io.hook.mockReset();io.lease=true;
  const path=mode==='journal'?`backups/${plan.runId}/pending-recovery.json`:mode==='output'?'generated/'+plan.targets[0].path:mode==='manifest'?GENERATION_MANIFEST_PATH:plan.evidence.sidecarPath;
  if(mode==='fence') {const marker=JSON.parse(text(path));marker.runId='another-run';io.disk.set(path,encode(JSON.stringify(marker)));}
  else io.disk.set(path,encode('external bytes'));
  const before=[...io.disk];
  expect(await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).toMatchObject({restored:false,recoveryRequired:true});
  expect([...io.disk]).toEqual(before);
});
it('resumes an explicitly retried pending recovery after a second lease loss',async()=>{
  const args=setup();const plan=await planProjectOutputs(args);expect(plan.targets.length).toBeGreaterThan(1);
  io.hook.mockImplementation((path:string)=>{if(path===GENERATION_MANIFEST_PATH)io.lease=false;});
  expect((await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent})).recoveryRequired).toBe(true);
  io.lease=true;io.hook.mockImplementation((path:string)=>{if(path.startsWith('generated/'))io.lease=false;});
  expect(await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).toMatchObject({restored:false,recoveryRequired:true});
  expect(JSON.parse(text(plan.evidence.sidecarPath)).phase).toBe('pending');
  io.hook.mockReset();io.lease=true;
  expect(await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).toMatchObject({restored:true,recoveryRequired:false});
  expect([...io.disk.keys()].filter(path=>path.startsWith('generated/'))).toEqual([]);
});

it('discovers a pending run after losing the in-memory handle without mutating any file',async()=>{
  const args=setup();const plan=await planProjectOutputs(args);
  io.hook.mockImplementation((path:string)=>{if(path.startsWith('generated/'))io.lease=false;});
  expect((await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent})).recoveryRequired).toBe(true);
  io.hook.mockReset();const before=[...io.disk];const writes=[...io.writes];
  const found=await findPendingProjectRecovery('owner',args.isCurrent);
  expect(found?.runId).toBe(plan.runId);expect(found?.context).toEqual(plan.context);
  expect([...io.disk]).toEqual(before);expect(io.writes).toEqual(writes);
  expect(await findPendingProjectRecovery('another-project',args.isCurrent)).toBeNull();
  io.lease=true;
  expect(await restoreProjectOutputs(found!.runId,found!.context,args.isCurrent)).toMatchObject({restored:true,recoveryRequired:false});
});
it('rejects discovery when the stored input is missing without changing pending evidence',async()=>{
  const args=setup();const plan=await planProjectOutputs(args);
  io.hook.mockImplementation((path:string)=>{if(path.startsWith('generated/'))io.lease=false;});
  await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});
  io.disk.delete(args.prepared.snapshot.path);const before=[...io.disk];
  await expect(findPendingProjectRecovery('owner',args.isCurrent)).rejects.toThrow(/snapshot/);
  expect([...io.disk]).toEqual(before);
});

it('does not require recovery when the server rejects the first fence after lease expiry',async()=>{
  const args=setup();const plan=await planProjectOutputs(args);const manifest=text(GENERATION_MANIFEST_PATH);io.rejectFence=true;
  expect(await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent})).toMatchObject({committed:false,recoveryRequired:false});
  expect(io.disk.has(plan.evidence.sidecarPath)).toBe(false);
  expect([...io.disk.keys()].filter(path=>path.startsWith('generated/'))).toEqual([]);
  expect(text(GENERATION_MANIFEST_PATH)).toBe(manifest);
});

it('restores accepted output when post-commit run bookkeeping failed',async()=>{
  const args=setup();const plan=await planProjectOutputs(args);io.failPath=`backups/${plan.runId}/run.json`;
  expect(await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent})).toMatchObject({committed:true,recoveryRequired:true});
  expect((await readProjectGenerationEvidence(plan.context)).inspection.state).toBe('partial');
  io.failPath='';
  expect(await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).toMatchObject({restored:true,recoveryRequired:false});
  expect([...io.disk.keys()].filter(path=>path.startsWith('generated/'))).toEqual([]);
  expect(io.disk.has(plan.evidence.sidecarPath)).toBe(false);
});
it.each(['scope','backup','request'])('rejects missing-run fallback with altered %s',async mode=>{
  const args=setup();const plan=await planProjectOutputs(args);io.failPath=`backups/${plan.runId}/run.json`;
  await commitProjectOutputs(plan,{}, {lock,isCurrent:args.isCurrent});io.failPath='';
  const path=`backups/${plan.runId}/pending-recovery.json`;const journal=JSON.parse(text(path));
  if(mode==='scope')journal.files.pop();else if(mode==='request')journal.requestId='another-request';
  else io.disk.set(`backups/${plan.runId}/generation-manifest.json`,encode('{}'));
  io.disk.set(path,encode(JSON.stringify(journal)));const before=[...io.disk];
  expect((await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).restored).toBe(false);
  expect([...io.disk]).toEqual(before);
});
it.each(['change','delete'])('rejects a retained output %s during a committed-wave restore',async mode=>{
  const args=setup();const first=await planProjectOutputs(args);await commitProjectOutputs(first,{}, {lock,isCurrent:args.isCurrent});
  const record=JSON.parse(text(first.evidence.sidecarPath));const next=structuredClone(args.prepared.request.plan);
  for(const ticket of next.tickets)if(record.outputs.some((output:{id:string})=>output.id===ticket.id))ticket.status='done';
  const second=await planProjectOutputs(prepare('second',args.prepared.request.project,next));
  expect((await commitProjectOutputs(second,{}, {lock,isCurrent:args.isCurrent})).committed).toBe(true);
  const retained='generated/'+record.outputs[0].filePath;
  io.hook.mockImplementation((path:string)=>{if(path==='generated/'+second.targets[0].path){if(mode==='delete')io.disk.delete(retained);else io.disk.set(retained,encode('external retained edit'));}});
  expect(await restoreProjectOutputs(second.runId,second.context,args.isCurrent)).toMatchObject({restored:false,recoveryRequired:true});
  expect(mode==='delete'?io.disk.has(retained):text(retained)).toBe(mode==='delete'?false:'external retained edit');
});

it.each(['missing','previous'].flatMap(mode=>['outputs','manifest','sidecar'].map(stage=>({mode,stage}))))('does not report a completed restore when $mode output changes after $stage write',async ({mode,stage})=>{
  const args=setup();const path=args.prepared.request.tickets[0].filePath;
  if(mode==='previous')io.disk.set('generated/'+path,encode('previous manual bytes'));
  const plan=await planProjectOutputs(args);
  const decisions=mode==='previous'?{[path]:'overwrite' as const}:{};
  expect((await commitProjectOutputs(plan,decisions,{lock,isCurrent:args.isCurrent})).committed).toBe(true);
  const manual='new manual bytes after restore';
  const injectionPath=stage==='outputs'?'generated/'+plan.targets.at(-1)!.path:stage==='manifest'?GENERATION_MANIFEST_PATH:plan.evidence.sidecarPath;
  let injected=false;
  io.hook.mockImplementation((writtenPath:string)=>{
    if(!injected&&writtenPath===injectionPath){injected=true;io.disk.set('generated/'+path,encode(manual));}
  });
  expect(await restoreProjectOutputs(plan.runId,plan.context,args.isCurrent)).toMatchObject({restored:false,recoveryRequired:true});
  expect(injected).toBe(true);
  expect(text('generated/'+path)).toBe(manual);
});

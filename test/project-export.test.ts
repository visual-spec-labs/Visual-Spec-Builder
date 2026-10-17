import { beforeEach, expect, it, vi } from 'vitest';
import type { FrameNode, ProjectSpec } from '@/features/editor/schema';
import { compileProjectTickets } from '@/features/editor/ticket/compileProjectTickets';
import { buildProjectInputSnapshot, createProjectAssetSnapshot, projectAssetPaths } from '@/features/editor/ticket/projectInputSnapshot';
import { buildProjectTicketRequest } from '@/features/editor/ticket/projectTicketProtocol';
import { sha256Hex } from '@/features/editor/export/contentHash';
import { GENERATION_MANIFEST_PATH } from '@/features/editor/export/generationManifest';
import { planProjectOutputs, commitProjectOutputs } from '@/features/editor/ui/projectOutputAcceptance';
import { inspectProjectExport, prepareProjectBundle } from '@/features/editor/ui/projectExport';
import { readCurrentProjectContext, readProjectGenerationEvidence } from '@/features/editor/ui/projectGenerationWorkspace';
import fixture from './fixtures/screen-relations-project.json';
const io=vi.hoisted(()=>({disk:new Map<string,Uint8Array>(),current:true,read:vi.fn()}));
const bytes=(text:string)=>new TextEncoder().encode(text);
vi.mock('@/features/editor/ui/workspaceClient',()=>({
  readWorkspaceFileSnapshot:async(path:string)=>{await io.read(path);return {ok:true,snapshot:io.disk.has(path)?{bytes:io.disk.get(path)!.slice(),revision:sha256Hex(io.disk.get(path)!)}:null};},
  writeWorkspaceFile:async(path:string,body:string|ArrayBuffer,_type:string,expected?:string)=>{
    const previous=io.disk.get(path);if(expected!==undefined&&expected!==(previous?sha256Hex(previous):'missing'))return {ok:false,status:409,error:'CAS'};
    io.disk.set(path,typeof body==='string'?bytes(body):new Uint8Array(body));return {ok:true,path};
  },
}));
const lock={renew:async()=>true,release:()=>{}};
let project:ProjectSpec;
beforeEach(()=>{
  io.disk.clear();io.current=true;io.read.mockReset();project={...structuredClone(fixture),projectId:'owner'} as unknown as ProjectSpec;
  const svg=bytes('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  for(const [page,path] of [['login','assets/a.svg'],['dashboard','assets/b.svg']]) {
    io.disk.set(path,svg);const root=project.pages[page].nodes.root;if(root.type!=='frame')throw Error('fixture root');root.background=[{type:'image',src:path,fit:'cover'}];
  }
  io.disk.set(GENERATION_MANIFEST_PATH,bytes(JSON.stringify({protocol:2,projects:{owner:{fileName:null,outputDir:'owned',createdAt:'now'}},entries:{}})));
});
async function generate(all=true,prefix='export') {
  let plan=compileProjectTickets(project);
  const current=await readCurrentProjectContext({requestId:`${prefix}-reconcile`,project,plan,projectRoot:'owned',isCurrent:()=>io.current});
  const evidence=await readProjectGenerationEvidence(current);
  for(const ticket of plan.tickets){
    const definition=current.outputs.find(output=>output.id===ticket.id)!;
    const previous=evidence.record?.outputs.find(output=>output.id===ticket.id&&output.filePath===definition.filePath&&output.inputFingerprint===definition.inputFingerprint);
    if(previous&&evidence.files.has(previous.filePath)&&sha256Hex(evidence.files.get(previous.filePath)!)===previous.sha256)ticket.status='done';
  }
  for(let wave=0;wave<10;wave++) {
    const id=`${prefix}-wave-${wave}`;const snapshot=buildProjectInputSnapshot(id,project,plan,projectAssetPaths(project).map(path=>createProjectAssetSnapshot(path,io.disk.get(path)!)));
    const ticketIds=plan.tickets.filter(ticket=>ticket.status!=='done'&&ticket.dependsOn.every(dep=>plan.tickets.find(item=>item.id===dep)?.status==='done')).map(ticket=>ticket.id);
    const request=buildProjectTicketRequest({requestId:id,projectRoot:'owned',snapshotContent:snapshot.content,snapshotSha256:snapshot.sha256,ticketIds});
    io.disk.set(snapshot.path,bytes(snapshot.content));
    for(const ticket of request.tickets)io.disk.set(ticket.outputPath,bytes(`const dependency=require("fixture-package/subpath"); export default function ${ticket.componentName}(){return <img alt="fixture" src="vsb-asset:${request.assets[0].sha256}"/>}`));
    const output=await planProjectOutputs({prepared:{request,snapshot},results:ticketIds.map(ticketId=>({ticketId,status:'done'})),runId:`${prefix}-run-${wave}`,isCurrent:()=>io.current});
    const decisions=Object.fromEntries(output.review.items.map(item=>[item.path,'overwrite' as const]));
    const accepted=await commitProjectOutputs(output,decisions, {lock,isCurrent:()=>io.current});
    if(!accepted.committed)throw Error(accepted.message??'wave not committed');
    plan={...plan,tickets:plan.tickets.map(ticket=>ticketIds.includes(ticket.id)?{...ticket,status:'done'}:ticket)};
    if(!all||plan.tickets.every(ticket=>ticket.status==='done'))return;
  }
  throw Error('fixture wave did not complete');
}
const input=()=>({project,fileName:null,documentId:1,isCurrent:()=>io.current});
function zipEntries(zip:Uint8Array) {
  const view=new DataView(zip.buffer,zip.byteOffset,zip.byteLength);const entries=new Map<string,Uint8Array>();let offset=0;
  while(view.getUint32(offset,true)===0x04034b50){const size=view.getUint32(offset+18,true);const length=view.getUint16(offset+26,true);const extra=view.getUint16(offset+28,true);const start=offset+30+length+extra;entries.set(new TextDecoder().decode(zip.slice(offset+30,offset+30+length)),zip.slice(start,start+size));offset=start+size;}
  return entries;
}
it('exports all pages/modals/runtime and deduplicates same bytes under their content hash',async()=>{
  await generate();expect((await inspectProjectExport(input())).evidence.inspection.state).toBe('current');
  const entries=zipEntries((await prepareProjectBundle(input())).zip);const paths=[...entries.keys()];
  expect(paths.some(path=>path.endsWith('/runtime/Entry.tsx'))).toBe(true);
  expect(paths.some(path=>path.includes('/resetPassword/pages/'))).toBe(true);
  const assets=paths.filter(path=>path.includes('/assets/'));expect(assets).toHaveLength(1);expect(entries.get(assets[0])).toEqual(io.disk.get('assets/a.svg'));
  expect(paths.some(path=>path.includes('/staging/')||path.includes('/backups/'))).toBe(false);
  const packagePath=paths.find(path=>path.endsWith('/package.json'))!;expect(JSON.parse(new TextDecoder().decode(entries.get(packagePath))).dependencies['fixture-package']).toBe('*');
});
it('exports one referenced shared widget with its asset and v5 manifest ownership',async()=>{
  const widget=project.pages.notificationWidget;
  const root=widget.nodes.root as FrameNode;
  root.background=[{type:'image',src:'assets/widget.svg',fit:'cover'}];
  io.disk.set('assets/widget.svg',bytes('<svg xmlns="http://www.w3.org/2000/svg" width="3"/>'));
  for(const pageId of ['login','dashboard']){
    const page=project.pages[pageId];
    page.nodes[`shared-${pageId}`]={type:'instance',name:'Notification',box:{width:200,height:100},ref:'notificationWidget'};
    (page.nodes.root as FrameNode).children.push({node:`shared-${pageId}`});
  }
  await generate();
  expect((await inspectProjectExport(input())).evidence.inspection.state).toBe('current');
  const entries=zipEntries((await prepareProjectBundle(input())).zip);
  const paths=[...entries.keys()];
  expect(paths.filter(path=>path.includes('/notificationWidget/components/'))).toHaveLength(2);
  const manifest=JSON.parse(new TextDecoder().decode(io.disk.get(GENERATION_MANIFEST_PATH)!));
  expect(Object.values(manifest.entries).filter((entry:any)=>entry.pageId==='notificationWidget').every((entry:any)=>entry.ticketProtocol===5)).toBe(true);
  expect(paths.some(path=>path.includes('/assets/')&&new TextDecoder().decode(entries.get(path)!).includes('width="3"'))).toBe(true);
});
it('keeps verified unaffected outputs through v4 to v5 and back without rewriting their protocol history',async()=>{
  await generate(true,'initial');
  const dashboard=Object.entries(JSON.parse(new TextDecoder().decode(io.disk.get(GENERATION_MANIFEST_PATH)!)).entries)
    .find(([path,entry]:[string,any])=>path.includes('/dashboard/')&&entry.pageId==='dashboard')?.[0];
  expect(dashboard).toBeDefined();
  const page=project.pages.login;
  page.nodes.shared={type:'instance',name:'Notification',box:{width:200,height:100},ref:'notificationWidget'};
  (page.nodes.root as FrameNode).children.push({node:'shared'});
  await generate(true,'with-widget');
  expect((await inspectProjectExport(input())).evidence.inspection.state).toBe('current');
  let manifest=JSON.parse(new TextDecoder().decode(io.disk.get(GENERATION_MANIFEST_PATH)!));
  expect(manifest.entries[dashboard!].ticketProtocol).toBe(4);
  expect(Object.values(manifest.entries).some((entry:any)=>entry.pageId==='notificationWidget'&&entry.ticketProtocol===5)).toBe(true);
  (page.nodes.root as FrameNode).children=(page.nodes.root as FrameNode).children.filter(child=>child.node!=='shared');
  delete page.nodes.shared;
  await generate(true,'without-widget');
  expect((await inspectProjectExport(input())).evidence.inspection.state).toBe('current');
  manifest=JSON.parse(new TextDecoder().decode(io.disk.get(GENERATION_MANIFEST_PATH)!));
  expect(manifest.entries[dashboard!].ticketProtocol).toBe(4);
  expect([...zipEntries((await prepareProjectBundle(input())).zip).keys()].some(path=>path.includes('/notificationWidget/'))).toBe(false);
});
it('refuses partial provenance instead of exporting a page-only subset',async()=>{
  await generate(false);expect((await inspectProjectExport(input())).evidence.inspection.state).toBe('partial');await expect(prepareProjectBundle(input())).rejects.toThrow(/전체/);
});
it.each(['source','generated'])('rechecks changed %s bytes at download time',async kind=>{
  await generate();expect((await inspectProjectExport(input())).evidence.inspection.state).toBe('current');
  if(kind==='source')io.disk.set('assets/a.svg',bytes('<svg xmlns="http://www.w3.org/2000/svg" width="2"/>'));
  else {const path=[...io.disk.keys()].find(path=>path.startsWith('generated/'))!;io.disk.set(path,bytes('manual later bytes'));expect((await inspectProjectExport(input())).evidence.inspection.state).toBe('unverified');}
  await expect(prepareProjectBundle(input())).rejects.toThrow();
});
it('cancels export when the document changes during a read',async()=>{
  await generate();io.read.mockImplementation((path:string)=>{if(path.startsWith('generated/'))io.current=false;});await expect(prepareProjectBundle(input())).rejects.toThrow(/취소|세대/);
});

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AddressInfo } from 'node:net';
import { createWorkspaceMiddleware, ensureWorkspaceDirs } from '@/features/workspace/workspaceServer';
import { holdRequestLock } from '@/features/editor/ui/agentRequestLock';
import { releaseRequestLock } from '@/features/editor/ui/workspaceClient';
import { prepareStoredProjectRequest } from '@/features/editor/ui/projectInputStorage';
import { planProjectOutputs, commitProjectOutputs, restoreProjectOutputs } from '@/features/editor/ui/projectOutputAcceptance';
import { readProjectGenerationEvidence } from '@/features/editor/ui/projectGenerationWorkspace';
import { compileProjectTickets } from '@/features/editor/ticket/compileProjectTickets';
import type { ProjectSpec } from '@/features/editor/schema';
import { GENERATION_MANIFEST_PATH } from '@/features/editor/export/generationManifest';
import fixture from './fixtures/screen-relations-project.json';

let root:string;let server:Server;let current:boolean;
let afterResponse:(path:string,method:string)=>void;
const nativeFetch=globalThis.fetch;
function seed(path:string,body:string) {const full=join(root,path);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,body);}
beforeEach(async()=>{
  current=true;afterResponse=()=>{};
  root=mkdtempSync(join(tmpdir(),'vsb-accept-http-'));ensureWorkspaceDirs(root);
  const middleware=createWorkspaceMiddleware(root);
  server=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  const origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // Only adapt browser-relative URLs/origin; actual client, lease, HTTP middleware,
  // revision hashing, immutable storage and filesystem mutations remain real.
  vi.stubGlobal('fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
    const path=String(input);const headers=new Headers(init?.headers);headers.set('origin',origin);
    const response=await nativeFetch(new URL(path,origin),{...init,headers});
    afterResponse(path,init?.method??'GET');return response;
  });
  seed(GENERATION_MANIFEST_PATH,JSON.stringify({protocol:2,projects:{owner:{fileName:null,outputDir:'owned',createdAt:'now'}},entries:{}}));
});
afterEach(async()=>{
  vi.unstubAllGlobals();await new Promise<void>(done=>server.close(()=>done()));rmSync(root,{recursive:true,force:true});
});
async function preparedWave() {
  const project={...structuredClone(fixture) as unknown as ProjectSpec,projectId:'owner'};
  const plan=compileProjectTickets(project);
  const ticketIds=plan.tickets.filter(ticket=>ticket.dependsOn.length===0).map(ticket=>ticket.id);
  const prepared=await prepareStoredProjectRequest({requestId:'http-wave',project,plan,projectRoot:'owned',ticketIds,isCurrent:()=>current});
  for(const ticket of prepared.request.tickets)seed(ticket.outputPath,`export default function ${ticket.componentName}(){return <div/>}`);
  return planProjectOutputs({prepared,results:prepared.request.tickets.map(ticket=>({ticketId:ticket.id,status:'done'})),runId:'http-run',isCurrent:()=>current});
}
it('accepts a real HTTP wave and restores original output/sidecar absence with a fresh lease',async()=>{
  const plan=await preparedWave();const lock=await holdRequestLock('ticket',plan.requestId);
  if(typeof lock==='string')throw Error(lock);
  try {
    expect(await commitProjectOutputs(plan,{}, {lock,isCurrent:()=>current})).toMatchObject({committed:true,recoveryRequired:false});
    expect((await readProjectGenerationEvidence(plan.context)).inspection.state).toBe('partial');
    expect(JSON.parse(readFileSync(join(root,`backups/${plan.runId}/run.json`),'utf8')).phase).toBe('committed');
  } finally {await releaseRequestLock('ticket',plan.requestId);lock.release();}
  expect(await restoreProjectOutputs(plan.runId,plan.context,()=>current)).toMatchObject({restored:true,recoveryRequired:false});
  expect(existsSync(join(root,plan.evidence.sidecarPath))).toBe(false);
  for(const target of plan.targets)expect(existsSync(join(root,'generated',target.path))).toBe(false);
});
it('compensates cancellation after the server persisted the sidecar using real conditional DELETE',async()=>{
  const plan=await preparedWave();const lock=await holdRequestLock('ticket',plan.requestId);
  if(typeof lock==='string')throw Error(lock);
  const manifest=readFileSync(join(root,GENERATION_MANIFEST_PATH));
  afterResponse=(path,method)=>{if(method==='PUT'&&path.endsWith(plan.evidence.sidecarPath))current=false;};
  try {
    expect(await commitProjectOutputs(plan,{}, {lock,isCurrent:()=>current})).toMatchObject({committed:false,recoveryRequired:false});
    expect(existsSync(join(root,plan.evidence.sidecarPath))).toBe(false);
    for(const target of plan.targets)expect(existsSync(join(root,'generated',target.path))).toBe(false);
    expect(readFileSync(join(root,GENERATION_MANIFEST_PATH))).toEqual(manifest);
  } finally {await releaseRequestLock('ticket',plan.requestId);lock.release();}
});

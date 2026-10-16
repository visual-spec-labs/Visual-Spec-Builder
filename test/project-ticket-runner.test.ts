import { beforeEach, expect, it, vi } from 'vitest';
import type { ProjectSpec } from '@/features/editor/schema';
import { useEditorStore } from '@/features/editor/store/editorStore';
import { useDocumentStore } from '@/features/editor/store/documentStore';
import { useTicketStore } from '@/features/editor/store/ticketStore';
import { buildProjectInputSnapshot } from '@/features/editor/ticket/projectInputSnapshot';
import { buildProjectTicketRequest } from '@/features/editor/ticket/projectTicketProtocol';
import { projectProvenanceContext } from '@/features/editor/export/projectGenerationProvenance';
import { parseProjectInputSnapshot } from '@/features/editor/ticket/projectInputSnapshot';
import { runProjectTickets, cancelProjectTicketRun, isProjectTicketPlanCurrent } from '@/features/editor/ui/projectTicketRunner';
import fixture from './fixtures/screen-relations-project.json';
const io=vi.hoisted(()=>({sequence:0,requests:[] as string[][],release:vi.fn(),beforeResponse:vi.fn(),commit:vi.fn(),failed:false,committed:false,review:false}));
vi.mock('@/features/editor/ui/generationTarget',()=>({ensureGenerationTarget:async()=>({ok:true,target:{projectId:'owner',outputDir:'owned',root:'owned/login'}})}));
vi.mock('@/features/editor/ticket/ticketAgentClient',async()=>{
  const input=await import('@/features/editor/ticket/projectInputSnapshot');const protocol=await import('@/features/editor/ticket/projectTicketProtocol');
  return {createTicketRequestId:()=>`request-${++io.sequence}`,
    requestProjectTicketBatch:async(args:{requestId:string;project:ProjectSpec;plan:Parameters<typeof buildProjectInputSnapshot>[2];projectRoot:string;ticketIds:string[]})=>{
      io.requests.push(args.ticketIds);const snapshot=input.buildProjectInputSnapshot(args.requestId,args.project,args.plan,[]);
      const request=protocol.buildProjectTicketRequest({requestId:args.requestId,projectRoot:args.projectRoot,snapshotContent:snapshot.content,snapshotSha256:snapshot.sha256,ticketIds:args.ticketIds});
      await io.beforeResponse();
      return {kind:'response',prepared:{request,snapshot},lock:{renew:async()=>true,release:io.release},
        result:{kind:'results',results:args.ticketIds.map(ticketId=>({ticketId,status:io.failed?'failed':'done',...(io.failed?{message:'agent failed'}:{})}))}};
    }};
});
vi.mock('@/features/editor/ui/projectOutputAcceptance',()=>({
  planProjectOutputs:async(args:{prepared:{snapshot:ReturnType<typeof buildProjectInputSnapshot>;request:ReturnType<typeof buildProjectTicketRequest>};results:unknown[];runId:string})=>{
    const parsed=parseProjectInputSnapshot(args.prepared.snapshot.content,args.prepared.snapshot.sha256,args.prepared.request.id);if(!parsed.ok)throw Error(parsed.error);
    return {runId:args.runId,results:args.results,targets:io.review?[{ownership:'unowned'}]:[],review:{requestId:args.prepared.request.id,items:[]},context:projectProvenanceContext(parsed.snapshot,'owned')};
  },
  commitProjectOutputs:async(plan:{results:unknown[]},_decisions:unknown,options:{isCurrent:()=>boolean})=>{
    await io.commit(options);return {committed:io.committed||options.isCurrent(),recoveryRequired:false,message:null,results:plan.results};
  },restoreProjectOutputs:vi.fn(),
}));
beforeEach(()=>{
  io.sequence=0;io.requests=[];io.release.mockReset();io.beforeResponse.mockReset();io.commit.mockReset();io.failed=false;io.committed=false;io.review=false;
  useEditorStore.getState().loadSpec({...structuredClone(fixture),projectId:'owner'} as unknown as ProjectSpec);
  useDocumentStore.setState({fileName:null,projectIdentity:0});useTicketStore.setState({lastProjectRun:null});
  useTicketStore.getState().compileProject(useEditorStore.getState().spec);
});
it('chains validated project waves and marks tickets done only after acceptance',async()=>{
  io.commit.mockImplementation(()=>expect(useTicketStore.getState().tickets.some(ticket=>ticket.status==='in-progress')).toBe(true));
  await runProjectTickets();expect(io.requests.length).toBeGreaterThan(1);
  expect(useTicketStore.getState().tickets.every(ticket=>ticket.status==='done')).toBe(true);
  expect(io.release).toHaveBeenCalledTimes(io.requests.length);expect(useTicketStore.getState().running).toBe(false);
});
it.each(['stop','recompile'])('retains the original lease through %s compensation',async action=>{
  io.commit.mockImplementation((options:{isCurrent:()=>boolean})=>{
    if(action==='stop')cancelProjectTicketRun();else useTicketStore.getState().compileProject(useEditorStore.getState().spec);
    expect(options.isCurrent()).toBe(false);expect(io.release).not.toHaveBeenCalled();
  });
  await runProjectTickets();expect(io.release).toHaveBeenCalledTimes(1);
  expect(useTicketStore.getState().tickets.every(ticket=>ticket.status==='pending')).toBe(true);
  expect(io.requests).toHaveLength(1);
});
it('rejects a response after the project document reference changes',async()=>{
  io.beforeResponse.mockImplementation(()=>useEditorStore.setState(state=>({spec:{...state.spec,name:'changed'}})));
  await runProjectTickets();expect(io.commit).not.toHaveBeenCalled();expect(io.release).toHaveBeenCalledTimes(1);
  expect(useTicketStore.getState().tickets.every(ticket=>ticket.status==='pending')).toBe(true);
});
it('page selection alone preserves project currentness',()=>{
  useEditorStore.setState({activePageId:'dashboard'});expect(isProjectTicketPlanCurrent()).toBe(true);
});
it.each(['identity','document'])('rejects a response after %s changes',async mode=>{
  io.beforeResponse.mockImplementation(()=>{if(mode==='identity')useDocumentStore.setState({projectIdentity:1});else useEditorStore.setState(state=>({documentId:state.documentId+1}));});
  await runProjectTickets();expect(io.commit).not.toHaveBeenCalled();expect(io.release).toHaveBeenCalledTimes(1);
  expect(useTicketStore.getState().tickets.every(ticket=>ticket.status==='pending')).toBe(true);
});
it('preserves a committed recovery handle after recompilation without marking the new plan done',async()=>{
  io.committed=true;io.commit.mockImplementation(()=>useTicketStore.getState().compileProject(useEditorStore.getState().spec));
  await runProjectTickets();expect(useTicketStore.getState().lastProjectRun).not.toBeNull();
  expect(useTicketStore.getState().tickets.every(ticket=>ticket.status==='pending')).toBe(true);expect(io.requests).toHaveLength(1);
});
it('cannot manufacture project done status with the manual dropdown store action',()=>{
  const first=useTicketStore.getState().tickets[0];useTicketStore.getState().markStatus(first.id,'done');
  expect(useTicketStore.getState().tickets[0].status).toBe('pending');
});
it('settles an outstanding overwrite review immediately when the document changes',async()=>{
  io.review=true;const run=runProjectTickets();await vi.waitFor(()=>expect(useTicketStore.getState().overwriteReview).not.toBeNull());
  useEditorStore.setState(state=>({spec:{...state.spec,name:'edited during review'}}));await run;
  expect(io.commit).not.toHaveBeenCalled();expect(io.release).toHaveBeenCalledTimes(1);
  expect(useTicketStore.getState().overwriteReview).toBeNull();expect(useTicketStore.getState().running).toBe(false);
});
it('keeps the whole failed wave pending and never promotes partial success',async()=>{
  io.failed=true;await runProjectTickets();expect(io.commit).not.toHaveBeenCalled();expect(io.requests).toHaveLength(1);
  expect(useTicketStore.getState().runError).toContain('agent failed');expect(useTicketStore.getState().tickets.every(ticket=>ticket.status==='pending')).toBe(true);
});

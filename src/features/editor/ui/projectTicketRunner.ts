import type { OverwriteDecision } from '@/features/editor/export/overwriteGuard';
import { needsDecision } from '@/features/editor/export/overwriteGuard';
import { useDocumentStore } from '@/features/editor/store/documentStore';
import { useEditorStore } from '@/features/editor/store/editorStore';
import { useTicketStore } from '@/features/editor/store/ticketStore';
import { createTicketRequestId, requestProjectTicketBatch } from '@/features/editor/ticket/ticketAgentClient';
import { applyTicketResults, readyTickets } from '@/features/editor/ticket/ticketStatus';
import type { ProjectTicket } from '@/features/editor/ticket/types';
import { createAgentRequestWait, type AgentRequestWait } from './agentRequestWait';
import { ensureGenerationTarget } from './generationTarget';
import { commitProjectOutputs, planProjectOutputs, restoreProjectOutputs } from './projectOutputAcceptance';

type Answer = Readonly<Record<string,OverwriteDecision>> | 'cancel';
type Active = {cancelled:boolean;generation:number;wait:AgentRequestWait|null;answer:((answer:Answer)=>void)|null};
let active:Active|null=null;
export function cancelProjectTicketRun() {if(active){active.cancelled=true;active.answer?.('cancel');}}
export function answerProjectOverwrite(answer:Answer):boolean {if(!active?.answer)return false;active.answer(answer);return true;}
export function extendProjectTicketWait():boolean {return active?.wait?.extend()??false;}
useTicketStore.subscribe((state,previous)=>{if(state.generation!==previous.generation)cancelProjectTicketRun();});
useEditorStore.subscribe((state,previous)=>{if(state.spec!==previous.spec||state.documentId!==previous.documentId)cancelProjectTicketRun();});
useDocumentStore.subscribe((state,previous)=>{if(state.projectIdentity!==previous.projectIdentity)cancelProjectTicketRun();});

/** Project edits invalidate the whole wave; switching only the selected page does not. */
export function isProjectTicketPlanCurrent():boolean {
  const state=useTicketStore.getState();const editor=useEditorStore.getState();
  return !!state.projectPlan&&state.sourceProject===editor.spec&&state.sourceDocumentId===editor.documentId
    &&state.sourceProjectIdentity===useDocumentStore.getState().projectIdentity;
}

export async function runProjectTickets(ticketId?:string):Promise<void> {
  const initial=useTicketStore.getState();
  if(active||initial.running||!initial.projectPlan||!initial.sourceProject||!isProjectTicketPlanCurrent())return;
  const project=initial.sourceProject;const generation=initial.generation;
  const documentId=initial.sourceDocumentId!;const projectIdentity=initial.sourceProjectIdentity!;
  const state:Active={cancelled:false,generation,wait:null,answer:null};active=state;
  const current=()=>active===state&&!state.cancelled&&useTicketStore.getState().generation===generation&&isProjectTicketPlanCurrent();
  const update=(patch:Partial<ReturnType<typeof useTicketStore.getState>>)=>{
    if(active===state&&useTicketStore.getState().generation===generation)useTicketStore.setState(patch);
  };
  update({running:true,runError:null,runErrorRetryable:false,acceptanceWarning:null});
  let pendingIds:string[]=[];
  try {
    const located=await ensureGenerationTarget({projectId:project.projectId,fileName:useDocumentStore.getState().fileName,
      documentId,pageId:initial.projectPlan.entryPageId,projectPageIds:Object.keys(project.pages),
      componentNames:initial.projectPlan.tickets.map(ticket=>ticket.componentName)});
    if(!current())return;
    if(!located.ok)throw Error(located.error);
    if(located.target.projectId!==project.projectId)throw Error('프로젝트 생성 신원이 달라졌습니다. 다시 생성하세요.');
    while(current()) {
      const latest=useTicketStore.getState();
      const wave=readyTickets(latest.tickets).filter(ticket=>ticketId===undefined||ticket.id===ticketId);
      if(!wave.length)return;
      pendingIds=wave.map(ticket=>ticket.id);
      const plan={...initial.projectPlan,tickets:latest.tickets as ProjectTicket[]};
      const requestId=createTicketRequestId();
      const wait=createAgentRequestWait(progress=>{if(state.wait===wait)update({wait:progress});});state.wait=wait;
      update({tickets:latest.tickets.map(ticket=>pendingIds.includes(ticket.id)?{...ticket,status:'in-progress'}:ticket),wait:{phase:'saving',deadline:null}});
      const outcome=await requestProjectTicketBatch({requestId,project,plan,projectRoot:located.target.outputDir,ticketIds:pendingIds,isCurrent:current},state,wait);
      state.wait=null;update({wait:null});
      if(outcome.kind!=='response') {
        if(outcome.kind!=='cancelled')update({runError:outcome.message,runErrorRetryable:['timeout','lockLost','connectionLost'].includes(outcome.kind)});
        return;
      }
      try {
        if(!current())return;
        if(outcome.result.kind!=='results')throw Error(outcome.result.kind==='malformed'?outcome.result.message:'현재 프로젝트 응답이 아닙니다.');
        if(outcome.result.results.some(item=>item.status!=='done')) {
          update({runError:outcome.result.results.filter(item=>item.status==='failed').map(item=>item.message).join(' ')});return;
        }
        const output=await planProjectOutputs({prepared:outcome.prepared,results:outcome.result.results,runId:createTicketRequestId(),isCurrent:current});
        if(!current())return;
        let decisions:Readonly<Record<string,OverwriteDecision>>={};
        if(output.targets.some(needsDecision)) {
          const answer=await new Promise<Answer>(resolve=>{
            state.answer=value=>{state.answer=null;update({overwriteReview:null});resolve(value);};
            update({overwriteReview:output.review});
          });
          if(answer==='cancel'||!current())return;decisions=answer;
        }
        const accepted=await commitProjectOutputs(output,decisions,{lock:outcome.lock,isCurrent:current});
        // Preserve recovery evidence even if Stop/recompile occurred after the commit
        // point. Never apply old ticket statuses to a new generation/document.
        if(accepted.committed||accepted.recoveryRequired)useTicketStore.setState({lastProjectRun:{runId:output.runId,context:output.context,documentId,projectIdentity},acceptanceWarning:accepted.message});
        if(!current())return;
        if(!accepted.committed){update({runError:accepted.message});return;}
        update({tickets:applyTicketResults(useTicketStore.getState().tickets,accepted.results)});
        pendingIds=[];
        if(accepted.recoveryRequired||ticketId!==undefined)return;
      } finally {outcome.lock.release();}
    }
  } catch(error) {update({runError:error instanceof Error?error.message:'프로젝트 티켓 전달에 실패했습니다.'});}
  finally {
    state.wait?.settle();state.answer?.('cancel');
    if(useTicketStore.getState().generation===generation&&active===state) {
      const tickets=useTicketStore.getState().tickets.map(ticket=>pendingIds.includes(ticket.id)&&ticket.status==='in-progress'?{...ticket,status:'pending' as const}:ticket);
      update({running:false,wait:null,overwriteReview:null,tickets});
    }
    if(active===state)active=null;
  }
}

export async function restoreLastProjectRun():Promise<void> {
  const initial=useTicketStore.getState();const run=initial.lastProjectRun;
  if(active||initial.running||!run)return;
  const state:Active={cancelled:false,generation:initial.generation,wait:null,answer:null};active=state;
  const current=()=>active===state&&!state.cancelled&&useTicketStore.getState().generation===initial.generation
    &&useEditorStore.getState().documentId===run.documentId&&useDocumentStore.getState().projectIdentity===run.projectIdentity;
  if(!current()){active=null;useTicketStore.setState({restoreMessage:'이 적용을 만든 문서에서 되돌리세요.'});return;}
  useTicketStore.setState({running:true,restoreMessage:null});
  try {
    const result=await restoreProjectOutputs(run.runId,run.context,current);
    if(useTicketStore.getState().lastProjectRun===run)useTicketStore.setState({
      lastProjectRun:result.restored?null:run,restoreMessage:result.restored?'프로젝트의 마지막 적용을 되돌렸습니다. 티켓을 다시 생성하세요.':result.message});
    if(result.restored&&useTicketStore.getState().generation===initial.generation)useTicketStore.setState({tickets:initial.tickets.map(ticket=>({...ticket,status:'pending',error:undefined}))});
  } finally {if(useTicketStore.getState().generation===initial.generation)useTicketStore.setState({running:false});if(active===state)active=null;}
}

import type { TicketResultItem } from '@/features/editor/ticket/ticketProtocol';
import { isProjectTicketRequestId, parseProjectTicketResponse, validateProjectTicketRequest } from '@/features/editor/ticket/projectTicketProtocol';
import { parseProjectInputSnapshot } from '@/features/editor/ticket/projectInputSnapshot';
import { contentHash, sha256Hex } from '@/features/editor/export/contentHash';
import { PROJECT_TEMPLATE_VERSION } from '@/features/editor/export/projectGenerationIdentity';
import { projectProvenanceContext, type ProjectGenerationProvenance } from '@/features/editor/export/projectGenerationProvenance';
import { rewriteProjectAssetModule } from '@/features/editor/export/projectAssetModules';
import { renderProjectRuntime } from '@/features/editor/export/projectRuntimeTemplates';
import { ticketComponentKey } from '@/features/editor/export/generationIdentity';
import { GENERATION_MANIFEST_PATH, withManifestUpdates, parseGenerationManifest, type ManifestEntry } from '@/features/editor/export/generationManifest';
import { needsDecision, type OverwriteDecision, type OverwriteReview, type OverwriteTarget } from '@/features/editor/export/overwriteGuard';
import { WORKSPACE_MAX_BODY_BYTES, WORKSPACE_MISSING_REVISION } from '@/features/workspace/protocol';
import type { prepareStoredProjectRequest } from './projectInputStorage';
import { holdRequestLock, type HeldRequestLock } from './agentRequestLock';
import { deleteWorkspaceFile, writeWorkspaceFile } from './workspaceClient';
import { readCurrentProjectContext, readProjectFile, readProjectGenerationEvidence, strictProjectText } from './projectGenerationWorkspace';

type StoredRequest = Awaited<ReturnType<typeof prepareStoredProjectRequest>>;
const bytes = (text: string) => new TextEncoder().encode(text);
const revision = (text: string) => sha256Hex(bytes(text));
const assertSize = (text: string) => { if (bytes(text).byteLength > WORKSPACE_MAX_BODY_BYTES) throw Error('프로젝트 수용 기록이 저장 크기 한도를 초과합니다.'); };
function externalImages(project: StoredRequest['request']['project']) {
  const urls = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    const item = value as Record<string, unknown>;
    if (item.type === 'image' && typeof item.src === 'string' && /^(https?:\/\/|data:)/i.test(item.src)) urls.add(item.src);
    Object.values(item).forEach(visit);
  };
  for (const screen of Object.values(project.pages)) if (screen.kind !== 'widget') visit(screen);
  return [...urls];
}

/** Plans one complete wave plus GUI artifacts when all page outputs become verified.
 * It reads source/current/staging bytes but never promotes outputs or changes document state.
 */
export async function planProjectOutputs(args: {
  prepared: StoredRequest; results: TicketResultItem[]; runId: string; isCurrent: () => boolean;
}) {
  const prepared = structuredClone(args.prepared); const results = structuredClone(args.results);
  const { runId, isCurrent } = args;
  if (!isProjectTicketRequestId(runId)) throw Error('복구 실행 ID가 유효하지 않습니다.');
  const parsed = parseProjectInputSnapshot(prepared.snapshot.content, prepared.snapshot.sha256, prepared.request.id);
  if (!parsed.ok) throw Error(parsed.error);
  const checked = validateProjectTicketRequest(prepared.request, prepared.snapshot.content, prepared.request.projectRoot);
  if (!checked.valid) throw Error(checked.message);
  const request = checked.request;
  const response = parseProjectTicketResponse(JSON.stringify({protocol:4,requestId:request.id,results}), request);
  if (response.kind !== 'results' || response.results.some(item => item.status !== 'done')) throw Error('완전한 성공 wave만 수용할 수 있습니다.');
  const storedInput = await readProjectFile(request.inputSnapshotPath, isCurrent);
  if (!storedInput || storedInput.revision !== request.inputSnapshotSha256 || strictProjectText(storedInput.bytes) !== prepared.snapshot.content) throw Error('저장된 요청 입력이 변경됐습니다.');
  const context = projectProvenanceContext(parsed.snapshot, request.projectRoot);
  const current = await readCurrentProjectContext({ requestId:request.id, project:context.snapshot.project, plan:context.snapshot.plan, projectRoot:context.projectRoot, isCurrent });
  if (current.fingerprints.project !== context.fingerprints.project) throw Error('요청 이후 소스 자산이 바뀌었습니다. 새 요청이 필요합니다.');
  const evidence = await readProjectGenerationEvidence(context, isCurrent);
  const expected = new Map(context.outputs.map(output => [output.id, output]));
  const retained = (evidence.record?.outputs ?? []).filter(output => {
    const definition = expected.get(output.id);
    return definition && output.filePath === definition.filePath && output.inputFingerprint === definition.inputFingerprint
      && output.scope === definition.scope && output.sourcePageId === definition.sourcePageId;
  });
  // A caller cannot manufacture accepted dependency statuses by marking tickets done.
  for (const ticket of request.plan.tickets) if (ticket.status === 'done' && !retained.some(output => output.id === ticket.id)) throw Error('done 티켓의 현재 수용 근거가 없습니다. 다시 컴파일하세요.');
  const nextOutputs = new Map(retained.map(output => [output.id, output]));
  const candidates = new Map<string,string>();
  const ownedModulePaths = context.outputs.map(output => output.filePath.slice(context.projectRoot.length + 1));
  for (const ticket of request.tickets) {
    const file = await readProjectFile(ticket.outputPath, isCurrent);
    if (!file || !strictProjectText(file.bytes).trim()) throw Error(`완료 응답의 임시 출력이 없습니다: ${ticket.outputPath}`);
    const transformed = await rewriteProjectAssetModule({source:strictProjectText(file.bytes), modulePath:ticket.filePath.slice(context.projectRoot.length+1), ownedModulePaths, assets:context.snapshot.assets, externalUrls:externalImages(context.snapshot.project)});
    candidates.set(ticket.filePath, transformed.code);
    nextOutputs.set(ticket.id, {...expected.get(ticket.id)!,sha256:revision(transformed.code),requestId:request.id});
  }
  if (context.snapshot.plan.tickets.every(ticket => nextOutputs.has(ticket.id))) {
    for (const [path, source] of renderProjectRuntime(context)) {
      candidates.set(path,source);
      const definition = context.outputs.find(output => output.filePath === path)!;
      nextOutputs.set(definition.id,{...definition,sha256:revision(source),requestId:request.id});
    }
  }
  const targets: OverwriteTarget[] = []; const updates: Record<string,ManifestEntry|null> = Object.create(null);
  const review: OverwriteReview = {requestId:request.id,items:[]};
  for (const [path,next] of candidates) {
    const definition = context.outputs.find(output => output.filePath === path)!;
    const currentFile = evidence.snapshots.get(path) ?? null;
    const record = evidence.manifest.entries[path] ?? null;
    const previous = evidence.record?.outputs.find(output => output.filePath === path && output.id === definition.id);
    const ownership = currentFile === null ? 'new' : previous ? (currentFile.revision === revision(next) ? 'unchanged' : 'owned')
      : record && (record.projectId !== context.snapshot.projectId || (definition.scope === 'page' && record.pageId !== definition.sourcePageId)) ? 'foreign' : 'unowned';
    const target: OverwriteTarget = {path,ticketId:definition.id,current:currentFile,next,record,ownership};targets.push(target);
    review.items.push({path,ticketId:definition.id,ownership,currentText:needsDecision(target)&&currentFile?strictProjectText(currentFile.bytes):null,nextText:next,baselineText:null});
    if (definition.scope === 'page') {
      const ticket = context.snapshot.plan.tickets.find(ticket => ticket.id === definition.id)!;
      updates[path] = {requestId:request.id,ticketId:ticket.id,componentName:ticket.componentName,projectId:context.snapshot.projectId,pageId:ticket.sourcePageId,
        componentKey:ticketComponentKey(ticket),inputScope:'page',inputFingerprint:definition.inputFingerprint,contentHash:contentHash(next),ticketProtocol:4,acceptedAt:new Date().toISOString()};
    } else updates[path] = null; // GUI artifacts never receive a fictitious page identity.
  }
  const sidecar: ProjectGenerationProvenance = {protocol:1,projectId:context.snapshot.projectId,projectRoot:context.projectRoot,plan:context.snapshot.plan,
    templateVersion:PROJECT_TEMPLATE_VERSION,inputFingerprint:context.fingerprints.project,assets:context.snapshot.assets,
    outputs:context.outputs.flatMap(output=>nextOutputs.has(output.id)?[nextOutputs.get(output.id)!]:[]),committedRunId:runId};
  const sidecarText = JSON.stringify(sidecar); const manifestText = JSON.stringify(withManifestUpdates(evidence.manifest,updates));
  assertSize(sidecarText);assertSize(manifestText);
  return {requestId:request.id,runId,context,targets,review,results:response.results,sidecarText,manifestText,evidence};
}
export type ProjectOutputPlan = Awaited<ReturnType<typeof planProjectOutputs>>;

interface ProjectRunFile {
  path:string;ticketId:string;previousRevision:string|null;backupPath:string|null;writtenRevision:string;previousEntry:ManifestEntry|null;
}
export interface ProjectOutputAcceptance {
  committed:boolean;runId:string;results:TicketResultItem[];recoveryRequired:boolean;message:string|null;
}
const backupRoot = (runId:string)=>`backups/${runId}`;
async function immutableText(path:string,text:string) {
  assertSize(text);
  const saved=await writeWorkspaceFile(path,text,'application/json',WORKSPACE_MISSING_REVISION);
  const actual=await readProjectFile(path);
  if (!actual || strictProjectText(actual.bytes)!==text) throw Error(`백업 기록을 확인하지 못했습니다: ${path}${saved.ok?'':` (${saved.error})`}`);
}

let acceptanceTail: Promise<unknown> = Promise.resolve();
/** One project wave is the acceptance unit; a single keep decision aborts the entire wave. */
export function commitProjectOutputs(plan:ProjectOutputPlan, decisions:Readonly<Record<string,OverwriteDecision>>, options:{lock:HeldRequestLock;isCurrent:()=>boolean}) {
  const captured=structuredClone(plan);const choices={...decisions};
  const result=acceptanceTail.then(()=>commitProjectOutputsNow(captured,choices,options));
  acceptanceTail=result.catch(()=>undefined);return result;
}
async function commitProjectOutputsNow(plan:ProjectOutputPlan, decisions:Readonly<Record<string,OverwriteDecision>>, {lock,isCurrent}:{lock:HeldRequestLock;isCurrent:()=>boolean}):Promise<ProjectOutputAcceptance> {
  const root=backupRoot(plan.runId);const files:ProjectRunFile[]=plan.targets.map(target=>({path:target.path,ticketId:target.ticketId,
    previousRevision:target.current?.revision??null,backupPath:target.current?`${root}/files/${target.path}`:null,writtenRevision:revision(target.next),previousEntry:target.record}));
  const attempted:ProjectRunFile[]=[];let manifestAttempted=false;let sidecarAttempted=false;
  const failed=(message:string,recoveryRequired=false):ProjectOutputAcceptance=>({committed:false,runId:plan.runId,recoveryRequired,message,results:plan.results.map(item=>({...item,status:'failed',message}))});
  const assertCurrent=async()=>{if(!isCurrent()||!await lock.renew(true)||!isCurrent())throw Error('취소되거나 프로젝트 요청 잠금을 잃었습니다.');};
  const expectedRevision=(file:{revision:string}|null)=>file?.revision??WORKSPACE_MISSING_REVISION;
  const sameFile=async(path:string,expected:string)=>expectedRevision(await readProjectFile(path))===expected;
  const runRecord=(phase:'committed'|'recovery',scope:ProjectRunFile[])=>({protocol:2,phase,runId:plan.runId,requestId:plan.requestId,createdAt:new Date().toISOString(),files:scope});
  const checkSource=async()=>{
    const current=await readCurrentProjectContext({requestId:plan.requestId,project:plan.context.snapshot.project,plan:plan.context.snapshot.plan,projectRoot:plan.context.projectRoot,isCurrent});
    if(current.fingerprints.project!==plan.context.fingerprints.project)throw Error('수용 중 현재 자산 바이트가 바뀌었습니다.');
  };
  const previousSidecar=plan.evidence.sidecarFile;
  const restore=(path:string,previous:{bytes:Uint8Array;revision:string}|null,writtenRevision:string)=>previous
    ? writeWorkspaceFile(path,previous.bytes.slice().buffer,'application/octet-stream',writtenRevision,plan.requestId)
    : deleteWorkspaceFile(path,writtenRevision,plan.requestId);
  const compensate=async():Promise<boolean>=>{
    // A newly acquired lease would not prove these historical writes. Keep evidence and
    // require explicit recovery if the original lease was lost; never roll back a newer run.
    if(!await lock.renew(true))return false;
    const sidecar=await readProjectFile(plan.evidence.sidecarPath);
    const manifest=await readProjectFile(GENERATION_MANIFEST_PATH);
    if(![expectedRevision(previousSidecar),revision(plan.sidecarText)].includes(expectedRevision(sidecar))
      || ![expectedRevision(plan.evidence.manifestFile),revision(plan.manifestText)].includes(expectedRevision(manifest)))return false;
    let complete=true;
    for(const file of [...attempted].reverse()) {
      if(!await lock.renew(true)){complete=false;break;}
      const target=plan.targets.find(target=>target.path===file.path)!;const path=`generated/${file.path}`;
      if(await sameFile(path,expectedRevision(target.current)))continue;
      if(!await sameFile(path,file.writtenRevision)){complete=false;continue;}
      await restore(path,target.current,file.writtenRevision);
      if(!await sameFile(path,expectedRevision(target.current)))complete=false;
    }
    if(!complete || !await lock.renew(true))return false;
    if(manifestAttempted && expectedRevision(manifest)===revision(plan.manifestText)) {
      if(!plan.evidence.manifestFile)return false; // Registry ownership required an existing manifest.
      await writeWorkspaceFile(GENERATION_MANIFEST_PATH,plan.evidence.manifestFile.bytes.slice().buffer,'application/json',undefined,plan.requestId);
      if(!await sameFile(GENERATION_MANIFEST_PATH,plan.evidence.manifestFile.revision))return false;
    }
    if(sidecarAttempted && expectedRevision(sidecar)===revision(plan.sidecarText)) {
      if(!await lock.renew(true))return false;
      await restore(plan.evidence.sidecarPath,previousSidecar,revision(plan.sidecarText));
      if(!await sameFile(plan.evidence.sidecarPath,expectedRevision(previousSidecar)))return false;
    }
    return true;
  };
  try {
    await assertCurrent();
    if(plan.targets.some(target=>needsDecision(target)&&decisions[target.path]!=='overwrite'))return failed('기존 파일 보존 선택으로 프로젝트 wave 전체를 적용하지 않았습니다.');
    if(await readProjectFile(`${root}/plan.json`))return failed('이미 사용한 복구 실행 ID입니다. 새 실행으로 다시 시도하세요.');
    await checkSource();
    // All backups precede every generated/metadata write, including unchanged bytes whose
    // request identity is being updated and must be restorable with the same run record.
    for(const target of plan.targets) {
      await assertCurrent();
      if(target.current) {
        const path=`${root}/files/${target.path}`;
        const saved=await writeWorkspaceFile(path,target.current.bytes.slice().buffer,'application/octet-stream',WORKSPACE_MISSING_REVISION);
        if(!saved.ok || !await sameFile(path,target.current.revision))throw Error(`원본 백업을 확인하지 못했습니다: ${target.path}`);
      }
    }
    if(previousSidecar) {
      const path=`${root}/project-generation.json`;
      const saved=await writeWorkspaceFile(path,previousSidecar.bytes.slice().buffer,'application/json',WORKSPACE_MISSING_REVISION);
      if(!saved.ok||!await sameFile(path,previousSidecar.revision))throw Error('이전 sidecar 원본 백업을 확인하지 못했습니다.');
    }
    await immutableText(`${root}/plan.json`,JSON.stringify({...runRecord('recovery',files),phase:'planned'}));
    await immutableText(`${root}/project-recovery.json`,JSON.stringify({protocol:1,runId:plan.runId,sidecarPath:plan.evidence.sidecarPath,
      previousSidecarPath:previousSidecar?`${root}/project-generation.json`:null,previousSha256:previousSidecar?.revision??null,writtenSha256:revision(plan.sidecarText)}));
    await assertCurrent();
    for(const target of plan.targets)if(!await sameFile(`generated/${target.path}`,expectedRevision(target.current)))throw Error('검토 뒤 생성 파일이 바뀌었습니다.');
    if(!await sameFile(GENERATION_MANIFEST_PATH,expectedRevision(plan.evidence.manifestFile)) || !await sameFile(plan.evidence.sidecarPath,expectedRevision(previousSidecar)))throw Error('검토 뒤 수용 기록이 바뀌었습니다.');
    for(const file of files) {
      const target=plan.targets.find(target=>target.path===file.path)!;
      if(target.ownership==='unchanged')continue;
      await assertCurrent();attempted.push(file);
      const saved=await writeWorkspaceFile(`generated/${file.path}`,target.next,'text/plain; charset=utf-8',expectedRevision(target.current),plan.requestId);
      if(!saved.ok) {if(saved.status===409)attempted.pop();throw Error(`출력 쓰기를 확인하지 못했습니다: ${file.path}`);}
      if(!await sameFile(`generated/${file.path}`,file.writtenRevision))throw Error('생성 출력 readback이 다릅니다.');
    }
    await assertCurrent();await checkSource();await assertCurrent();
    if(!await sameFile(GENERATION_MANIFEST_PATH,expectedRevision(plan.evidence.manifestFile)))throw Error('수용 중 manifest가 바뀌었습니다.');
    manifestAttempted=true;
    const manifestSaved=await writeWorkspaceFile(GENERATION_MANIFEST_PATH,plan.manifestText,'application/json',undefined,plan.requestId);
    if(!manifestSaved.ok || !await sameFile(GENERATION_MANIFEST_PATH,revision(plan.manifestText)))throw Error('프로젝트 manifest 기록을 확인하지 못했습니다.');
    await assertCurrent();sidecarAttempted=true;
    const sidecarSaved=await writeWorkspaceFile(plan.evidence.sidecarPath,plan.sidecarText,'application/json',expectedRevision(previousSidecar),plan.requestId);
    if(!sidecarSaved.ok || !await sameFile(plan.evidence.sidecarPath,revision(plan.sidecarText)))throw Error('프로젝트 sidecar 기록을 확인하지 못했습니다.');
    await assertCurrent();
  } catch(error) {
    const message=error instanceof Error?error.message:'프로젝트 수용에 실패했습니다.';
    if(!attempted.length&&!manifestAttempted&&!sidecarAttempted)return failed(message);
    let restored=false;try{restored=await compensate();}catch{/* Preserve bytes and report unresolved scope. */}
    try{await immutableText(`${root}/run.json`,JSON.stringify(runRecord('recovery',manifestAttempted?files:attempted)));}catch{return failed(`${message} 복구 범위 기록에 실패했습니다. 백업 ${root}를 보존하세요.`,true);}
    return failed(`${message}${restored?' 이번 적용을 되돌렸습니다.':' 복구 확인이 필요합니다.'}`,!restored);
  }
  // Commit point follows sidecar readback and the final cancellation/lease check. Stop
  // during immutable bookkeeping prevents later waves, not an already committed run.
  try{await immutableText(`${root}/run.json`,JSON.stringify(runRecord('committed',files)));}
  catch{return {committed:true,runId:plan.runId,results:plan.results,recoveryRequired:true,message:`복구 범위를 기록하지 못했습니다. 백업 ${root}를 보존하세요.`};}
  return {committed:true,runId:plan.runId,results:plan.results,recoveryRequired:false,message:null};
}

export interface ProjectRestoreResult { restored:boolean;recoveryRequired:boolean;message:string|null }
/** Explicit restore only: a new lease never manufactures missing historical provenance. */
export function restoreProjectOutputs(runId:string, context:ProjectOutputPlan['context'], isCurrent:()=>boolean) {
  const captured=projectProvenanceContext(context.snapshot,context.projectRoot);
  const result=acceptanceTail.then(()=>restoreProjectOutputsNow(runId,captured,isCurrent));
  acceptanceTail=result.catch(()=>undefined);return result;
}
async function restoreProjectOutputsNow(runId:string,context:ProjectOutputPlan['context'],isCurrent:()=>boolean):Promise<ProjectRestoreResult> {
  const fail=(message:string,recoveryRequired=false):ProjectRestoreResult=>({restored:false,recoveryRequired,message});
  if(!isProjectTicketRequestId(runId))return fail('복구 실행 ID가 유효하지 않습니다.');
  const owner=`restore-${crypto.randomUUID()}`;
  const lock=await holdRequestLock('ticket',owner,()=>!isCurrent());
  if(typeof lock==='string')return fail('프로젝트 복구 잠금을 얻지 못했습니다.');
  const check=async()=>{if(!isCurrent()||!await lock.renew(true)||!isCurrent())throw Error('복구가 취소되거나 잠금을 잃었습니다.');};
  try {
    await check();
    const root=backupRoot(runId);
    const runFile=await readProjectFile(`${root}/run.json`,isCurrent);
    const auxiliary=await readProjectFile(`${root}/project-recovery.json`,isCurrent);
    if(!runFile||!auxiliary)return fail('실제 적용 범위/프로젝트 복구 기록이 없습니다. plan.json은 복구 권한이 아닙니다.');
    const run=JSON.parse(strictProjectText(runFile.bytes));const recovery=JSON.parse(strictProjectText(auxiliary.bytes));
    const exact=(value:unknown,keys:string[])=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
    const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
    if(!exact(run,['protocol','phase','runId','requestId','createdAt','files'])||run.protocol!==2||!['committed','recovery'].includes(run.phase)||run.runId!==runId||!isProjectTicketRequestId(run.requestId)||typeof run.createdAt!=='string'||!Array.isArray(run.files))return fail('복구 범위 기록이 유효하지 않습니다.');
    const evidence=await readProjectGenerationEvidence(context,isCurrent);
    if(!evidence.record||!evidence.sidecarFile||evidence.record.committedRunId!==runId)return fail('현재 수용 기록이 이 실행을 증명하지 않습니다. 파일을 보존합니다.',true);
    if(!exact(recovery,['protocol','runId','sidecarPath','previousSidecarPath','previousSha256','writtenSha256'])||recovery.protocol!==1||recovery.runId!==runId||recovery.sidecarPath!==evidence.sidecarPath
      ||!hash(recovery.writtenSha256)||recovery.writtenSha256!==evidence.sidecarFile.revision
      || !((recovery.previousSidecarPath===null&&recovery.previousSha256===null)||(recovery.previousSidecarPath===`${root}/project-generation.json`&&hash(recovery.previousSha256))))return fail('sidecar 복구 근거가 현재 기록과 다릅니다.',true);
    const previousSidecar=recovery.previousSidecarPath===null?null:await readProjectFile(recovery.previousSidecarPath,isCurrent);
    if(recovery.previousSidecarPath!==null&&(!previousSidecar||previousSidecar.revision!==recovery.previousSha256))return fail('이전 sidecar 백업 hash가 다릅니다.',true);
    const paths=new Set<string>();const previousEntries:Record<string,ManifestEntry|null>=Object.create(null);
    const files:{file:ProjectRunFile;previous:Awaited<ReturnType<typeof readProjectFile>>;accepted:NonNullable<Awaited<ReturnType<typeof readProjectFile>>>}[]=[];
    for(const file of run.files as ProjectRunFile[]) {
      if(!exact(file,['path','ticketId','previousRevision','backupPath','writtenRevision','previousEntry'])||typeof file.path!=='string'||paths.has(file.path)||typeof file.ticketId!=='string'||!hash(file.writtenRevision)
        ||!((file.previousRevision===null&&file.backupPath===null)||(hash(file.previousRevision)&&file.backupPath===`${root}/files/${file.path}`)))return fail('파일 복구 범위/백업 경로가 유효하지 않습니다.');
      paths.add(file.path);
      const output=evidence.record.outputs.find(output=>output.filePath===file.path&&output.id===file.ticketId);
      if(!output||output.requestId!==run.requestId||output.sha256!==file.writtenRevision)return fail('현재 출력이 이 실행의 파일임을 증명하지 못했습니다.',true);
      if(file.previousEntry!==null&&!parseGenerationManifest(JSON.stringify({protocol:2,projects:{},entries:{previous:file.previousEntry}})).entries.previous)return fail('이전 manifest 항목이 유효하지 않습니다.');
      const previous=file.backupPath===null?null:await readProjectFile(file.backupPath,isCurrent);
      if(file.backupPath!==null&&(!previous||previous.revision!==file.previousRevision))return fail('원본 백업 hash가 다릅니다.',true);
      const accepted=evidence.snapshots.get(file.path);
      if(!accepted||accepted.revision!==file.writtenRevision)return fail('현재 생성 파일이 변경됐습니다.',true);
      files.push({file,previous,accepted});previousEntries[file.path]=file.previousEntry;
    }
    // A truncated run record must not roll metadata back while leaving a subset of
    // this wave's accepted files behind. The current sidecar independently binds scope.
    const acceptedScope=evidence.record.outputs.filter(output=>output.requestId===run.requestId);
    if(acceptedScope.length!==paths.size||acceptedScope.some(output=>!paths.has(output.filePath)))return fail('복구 범위가 현재 실행의 전체 출력과 다릅니다.',true);
    const restoredManifest=JSON.stringify(withManifestUpdates(evidence.manifest,previousEntries));assertSize(restoredManifest);
    const same=async(path:string,expected:string)=>((await readProjectFile(path))?.revision??WORKSPACE_MISSING_REVISION)===expected;
    const mutate=async(path:string,body:Uint8Array|null,expected:string)=>body
      ? writeWorkspaceFile(path,body.slice().buffer,'application/octet-stream',expected,owner)
      : deleteWorkspaceFile(path,expected,owner);
    const changed:typeof files=[];let manifestAttempted=false;let sidecarAttempted=false;let conflict=false;
    try {
      await check();
      // The evidence reader checked all accepted outputs; pin metadata again immediately
      // before the first mutation so a later committed wave is never restored accidentally.
      if(!await same(evidence.sidecarPath,evidence.sidecarFile.revision)||!evidence.manifestFile||!await same(GENERATION_MANIFEST_PATH,evidence.manifestFile.revision))throw Error('복구 확인 뒤 수용 기록이 바뀌었습니다.');
      for(const item of files) {
        await check();changed.push(item);
        const saved=await mutate(`generated/${item.file.path}`,item.previous?.bytes??null,item.file.writtenRevision);
        if(!saved.ok){if(saved.status===409){changed.pop();conflict=true;}throw Error('파일 복구가 충돌하거나 실패했습니다.');}
        if(!await same(`generated/${item.file.path}`,item.file.previousRevision??WORKSPACE_MISSING_REVISION))throw Error('파일 복구 readback이 다릅니다.');
      }
      await check();manifestAttempted=true;
      const metadata=await writeWorkspaceFile(GENERATION_MANIFEST_PATH,restoredManifest,'application/json',undefined,owner);
      if(!metadata.ok||!await same(GENERATION_MANIFEST_PATH,revision(restoredManifest)))throw Error('이전 manifest 항목 복원을 확인하지 못했습니다.');
      await check();sidecarAttempted=true;
      const restored=await mutate(evidence.sidecarPath,previousSidecar?.bytes??null,evidence.sidecarFile.revision);
      if(!restored.ok||!await same(evidence.sidecarPath,previousSidecar?.revision??WORKSPACE_MISSING_REVISION))throw Error('이전 sidecar 복원을 확인하지 못했습니다.');
      await check();
      return {restored:true,recoveryRequired:false,message:null};
    } catch(error) {
      // If restore itself fails, return to the accepted bytes while still holding this
      // same lease. A lost lease or a manual change leaves an explicit unresolved state.
      let complete=await lock.renew(true);
      if(complete) {
        for(const item of [...changed].reverse()) {
          if(!await lock.renew(true)){complete=false;break;}
          const path=`generated/${item.file.path}`;
          if(await same(path,item.file.writtenRevision))continue;
          if(!await same(path,item.file.previousRevision??WORKSPACE_MISSING_REVISION)){complete=false;continue;}
          await mutate(path,item.accepted.bytes,item.file.previousRevision??WORKSPACE_MISSING_REVISION);
          if(!await same(path,item.file.writtenRevision))complete=false;
        }
        if(complete&&manifestAttempted&&evidence.manifestFile) {
          if(await same(GENERATION_MANIFEST_PATH,revision(restoredManifest))&&await lock.renew(true)) {
            await writeWorkspaceFile(GENERATION_MANIFEST_PATH,evidence.manifestFile.bytes.slice().buffer,'application/json',undefined,owner);
          }
          complete=await same(GENERATION_MANIFEST_PATH,evidence.manifestFile.revision);
        }
        if(complete&&sidecarAttempted) {
          if(await same(evidence.sidecarPath,previousSidecar?.revision??WORKSPACE_MISSING_REVISION)&&await lock.renew(true))await mutate(evidence.sidecarPath,evidence.sidecarFile.bytes,previousSidecar?.revision??WORKSPACE_MISSING_REVISION);
          complete=await same(evidence.sidecarPath,evidence.sidecarFile.revision);
        }
      }
      complete=complete&&!conflict;
      return fail(`${error instanceof Error?error.message:'프로젝트 복구에 실패했습니다.'}${complete?' 기존 수용 상태를 유지했습니다.':' 복구 확인이 필요합니다.'}`,!complete);
    }
  } catch(error){return fail(error instanceof Error?error.message:'프로젝트 복구 근거를 읽지 못했습니다.',true);}
  finally{lock.release();}
}

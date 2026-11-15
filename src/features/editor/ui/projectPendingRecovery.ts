import { parseProjectInputSnapshot } from '@/features/editor/ticket/projectInputSnapshot';
import { GENERATION_MANIFEST_PATH, parseGenerationManifest } from '@/features/editor/export/generationManifest';
import { projectGenerationPath } from '@/features/editor/export/projectGenerationIdentity';
import { projectProvenanceContext, type ProjectProvenanceContext } from '@/features/editor/export/projectGenerationProvenance';
import { isProjectTicketRequestId } from '@/features/editor/ticket/projectTicketProtocol';
import { WORKSPACE_MISSING_REVISION } from '@/features/workspace/protocol';
import type { HeldRequestLock } from './agentRequestLock';
import { readProjectFile, strictProjectText } from './projectGenerationWorkspace';
import { deleteWorkspaceFile, writeWorkspaceFile } from './workspaceClient';

export interface PendingProjectRecovery {
  protocol: 2; phase: 'pending'; projectId: string; runId: string; requestId: string; journalSha256: string;
}
export interface ProjectRecoveryJournal {
  protocol: 1; projectId: string; projectRoot: string; runId: string; requestId: string;
  files: {path:string;ticketId:string;previousRevision:string|null;backupPath:string|null;writtenRevision:string}[];
  retained: {filePath:string;sha256:string}[];
  previousSidecarRevision: string|null;
  previousManifestRevision: string;
  writtenManifestRevision: string;
}
const revision=(value:Awaited<ReturnType<typeof readProjectFile>>)=>value?.revision??WORKSPACE_MISSING_REVISION;
const exact=(value:unknown,keys:string[]):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function isPendingProjectRecovery(text:string):boolean {
  try {const value=JSON.parse(text);return value?.protocol===2&&value?.phase==='pending';}catch{return false;}
}

/** A pending sidecar is the generation fence; a plan/run file alone is never authority.
 * Interrupted restores keep that fence so a subsequent explicit attempt can resume.
 */
export async function recoverPendingProjectOutputs(args:{
  runId:string;context:ProjectProvenanceContext;marker:NonNullable<Awaited<ReturnType<typeof readProjectFile>>>;
  lock:HeldRequestLock;owner:string;isCurrent:()=>boolean;
}) {
  const {runId,context,marker,lock,owner,isCurrent}=args;
  const fail=(message:string)=>({restored:false,recoveryRequired:true,message});
  const sidecarPath=projectGenerationPath(context.snapshot.projectId);const root=`backups/${runId}`;
  const same=async(path:string,expected:string)=>revision(await readProjectFile(path))===expected;
  const check=async()=>{
    if(!isCurrent()||!await lock.renew(true)||!isCurrent())throw Error('프로젝트 복구가 취소되거나 잠금을 잃었습니다.');
    if(!await same(sidecarPath,marker.revision))throw Error('다른 실행이 프로젝트 복구 기록을 변경했습니다.');
  };
  try {
    const pending:unknown=JSON.parse(strictProjectText(marker.bytes));
    if(!exact(pending,['protocol','phase','projectId','runId','requestId','journalSha256'])||pending.protocol!==2||pending.phase!=='pending'
      ||pending.projectId!==context.snapshot.projectId||pending.runId!==runId||typeof pending.requestId!=='string'||!isProjectTicketRequestId(pending.requestId)||!hash(pending.journalSha256))return fail('미커밋 복구 소유권 기록이 유효하지 않습니다.');
    const journalFile=await readProjectFile(`${root}/pending-recovery.json`,isCurrent);
    if(!journalFile||journalFile.revision!==pending.journalSha256)return fail('미커밋 복구 저널 hash가 다릅니다.');
    const value:unknown=JSON.parse(strictProjectText(journalFile.bytes));
    if(!exact(value,['protocol','projectId','projectRoot','runId','requestId','files','retained','previousSidecarRevision','previousManifestRevision','writtenManifestRevision'])
      ||value.protocol!==1||value.projectId!==context.snapshot.projectId||value.projectRoot!==context.projectRoot||value.runId!==runId||value.requestId!==pending.requestId
      ||!Array.isArray(value.files)||!value.files.length||!Array.isArray(value.retained)
      ||!(value.previousSidecarRevision===null||hash(value.previousSidecarRevision))||!hash(value.previousManifestRevision)||!hash(value.writtenManifestRevision))return fail('미커밋 복구 저널 형태가 유효하지 않습니다.');
    const journal=value as unknown as ProjectRecoveryJournal;
    const paths=new Set<string>();const files=[];
    for(const file of journal.files) {
      if(!exact(file,['path','ticketId','previousRevision','backupPath','writtenRevision'])||typeof file.path!=='string'||paths.has(file.path)
        ||!context.outputs.some(output=>output.filePath===file.path&&output.id===file.ticketId)||!hash(file.writtenRevision)
        ||!((file.previousRevision===null&&file.backupPath===null)||(hash(file.previousRevision)&&file.backupPath===`${root}/files/${file.path}`)))return fail('미커밋 복구 파일 범위가 유효하지 않습니다.');
      paths.add(file.path);
      const previous=file.backupPath===null?null:await readProjectFile(file.backupPath,isCurrent);
      if(revision(previous)!==(file.previousRevision??WORKSPACE_MISSING_REVISION))return fail('미커밋 복구 원본 백업 hash가 다릅니다.');
      files.push({file,previous});
    }
    for(const retained of journal.retained) {
      if(!exact(retained,['filePath','sha256'])||typeof retained.filePath!=='string'||paths.has(retained.filePath)||!hash(retained.sha256)
        ||!context.outputs.some(output=>output.filePath===retained.filePath))return fail('유지 출력의 복구 범위가 유효하지 않습니다.');
      paths.add(retained.filePath);
    }
    const manifest=await readProjectFile(`${root}/generation-manifest.json`,isCurrent);
    const previousSidecar=journal.previousSidecarRevision===null?null:await readProjectFile(`${root}/project-generation.json`,isCurrent);
    if(!manifest||manifest.revision!==journal.previousManifestRevision||revision(previousSidecar)!==(journal.previousSidecarRevision??WORKSPACE_MISSING_REVISION))return fail('프로젝트 복구 metadata 백업 hash가 다릅니다.');
    const registry=parseGenerationManifest(strictProjectText(manifest.bytes));
    if(registry.protocol!==2||registry.projects[journal.projectId]?.outputDir!==journal.projectRoot)return fail('복구 원본의 프로젝트 소유권이 다릅니다.');
    const checkRetained=async()=>{for(const output of journal.retained)if(!await same(`generated/${output.filePath}`,output.sha256))throw Error('이전 wave의 유지 출력이 변경됐습니다. 외부 변경을 보존합니다.');};
    const checkManifest=async()=>{const current=revision(await readProjectFile(GENERATION_MANIFEST_PATH));if(current!==journal.previousManifestRevision&&current!==journal.writtenManifestRevision)throw Error('다른 실행 또는 외부 변경의 manifest를 보존합니다.');};
    await check();await checkRetained();await checkManifest();
    // Preflight the complete scope before changing even one file. Missing new outputs
    // and already restored originals are valid resumable states, never proof of success alone.
    for(const {file} of files) {
      const current=revision(await readProjectFile(`generated/${file.path}`,isCurrent));
      if(current!==file.writtenRevision&&current!==(file.previousRevision??WORKSPACE_MISSING_REVISION))return fail('미커밋 출력의 외부 변경을 보존합니다.');
    }
    for(const {file,previous} of files) {
      await check();const path=`generated/${file.path}`;
      if(await same(path,file.previousRevision??WORKSPACE_MISSING_REVISION))continue;
      const saved=previous?await writeWorkspaceFile(path,previous.bytes.slice().buffer,'application/octet-stream',file.writtenRevision,owner):await deleteWorkspaceFile(path,file.writtenRevision,owner);
      if(!saved.ok||!await same(path,file.previousRevision??WORKSPACE_MISSING_REVISION))throw Error('미커밋 출력 복구가 충돌하거나 실패했습니다.');
    }
    await check();await checkRetained();await checkManifest();
    for(const {file} of files)if(!await same(`generated/${file.path}`,file.previousRevision??WORKSPACE_MISSING_REVISION))throw Error('복구된 출력이 다시 변경됐습니다.');
    if(!await same(GENERATION_MANIFEST_PATH,journal.previousManifestRevision)) {
      const saved=await writeWorkspaceFile(GENERATION_MANIFEST_PATH,manifest.bytes.slice().buffer,'application/json',undefined,owner);
      if(!saved.ok||!await same(GENERATION_MANIFEST_PATH,journal.previousManifestRevision))throw Error('미커밋 manifest 복구를 확인하지 못했습니다.');
    }
    await check();await checkRetained();
    for(const {file} of files)if(!await same(`generated/${file.path}`,file.previousRevision??WORKSPACE_MISSING_REVISION))throw Error('복구 확정 전 출력이 변경됐습니다.');
    if(!await same(GENERATION_MANIFEST_PATH,journal.previousManifestRevision))throw Error('복구 확정 전 manifest가 변경됐습니다.');
    const saved=previousSidecar?await writeWorkspaceFile(sidecarPath,previousSidecar.bytes.slice().buffer,'application/json',marker.revision,owner):await deleteWorkspaceFile(sidecarPath,marker.revision,owner);
    if(!saved.ok||!await same(sidecarPath,journal.previousSidecarRevision??WORKSPACE_MISSING_REVISION))throw Error('미커밋 sidecar 복구를 확인하지 못했습니다.');
    return {restored:true,recoveryRequired:false,message:null};
  }catch(error){return fail(error instanceof Error?error.message:'미커밋 프로젝트 복구에 실패했습니다.');}
}

/** Read-only discovery after reload. This handle is not restore authorization:
 * recoverPendingProjectOutputs rechecks the fence, journal and every byte under a new lease.
 */
export async function findPendingProjectRecovery(projectId:string,isCurrent:()=>boolean) {
  const marker=await readProjectFile(projectGenerationPath(projectId),isCurrent);
  if(!marker||!isPendingProjectRecovery(strictProjectText(marker.bytes)))return null;
  const value:unknown=JSON.parse(strictProjectText(marker.bytes));
  if(!exact(value,['protocol','phase','projectId','runId','requestId','journalSha256'])||value.projectId!==projectId
    ||typeof value.runId!=='string'||!isProjectTicketRequestId(value.runId)||typeof value.requestId!=='string'||!isProjectTicketRequestId(value.requestId)||!hash(value.journalSha256))throw Error('미완료 적용 기록의 신원이 유효하지 않습니다.');
  const journalFile=await readProjectFile(`backups/${value.runId}/pending-recovery.json`,isCurrent);
  if(!journalFile||journalFile.revision!==value.journalSha256)throw Error('미완료 적용 저널 hash가 다릅니다.');
  const journal=JSON.parse(strictProjectText(journalFile.bytes));
  if(journal?.protocol!==1||journal.projectId!==projectId||journal.runId!==value.runId||journal.requestId!==value.requestId||typeof journal.projectRoot!=='string')throw Error('미완료 적용 저널의 신원이 다릅니다.');
  const input=await readProjectFile(`runtime/project-input-${value.requestId}.json`,isCurrent);
  if(!input)throw Error('미완료 적용의 입력 snapshot이 없습니다.');
  const parsed=parseProjectInputSnapshot(strictProjectText(input.bytes),input.revision,value.requestId);
  if(!parsed.ok||parsed.snapshot.projectId!==projectId)throw Error('미완료 적용의 입력 snapshot이 유효하지 않습니다.');
  const context=projectProvenanceContext(parsed.snapshot,journal.projectRoot);
  const manifest=await readProjectFile(GENERATION_MANIFEST_PATH,isCurrent);
  const registry=parseGenerationManifest(manifest?strictProjectText(manifest.bytes):null);
  if(registry.protocol!==2||registry.projects[projectId]?.outputDir!==context.projectRoot)throw Error('미완료 적용의 생성 폴더 소유권이 다릅니다.');
  if(!isCurrent()||revision(await readProjectFile(projectGenerationPath(projectId),isCurrent))!==marker.revision)throw Error('확인 중 미완료 적용이 변경됐습니다.');
  return {runId:value.runId,context};
}

/** Recover a missing post-commit run record only when the caller has independently
 * verified the current committed sidecar. The reconstructed record still passes the
 * normal complete-scope, output, auxiliary-sidecar and backup checks in restore.
 */
export async function readCommittedProjectRun(runId:string,context:ProjectProvenanceContext,isCurrent:()=>boolean) {
  const root=`backups/${runId}`;const journalFile=await readProjectFile(`${root}/pending-recovery.json`,isCurrent);
  if(!journalFile)return null;
  const value:unknown=JSON.parse(strictProjectText(journalFile.bytes));
  if(!exact(value,['protocol','projectId','projectRoot','runId','requestId','files','retained','previousSidecarRevision','previousManifestRevision','writtenManifestRevision'])
    ||value.protocol!==1||value.projectId!==context.snapshot.projectId||value.projectRoot!==context.projectRoot||value.runId!==runId
    ||typeof value.requestId!=='string'||!isProjectTicketRequestId(value.requestId)||!Array.isArray(value.files)||!value.files.length||!Array.isArray(value.retained)
    ||!(value.previousSidecarRevision===null||hash(value.previousSidecarRevision))||!hash(value.previousManifestRevision)||!hash(value.writtenManifestRevision))throw Error('완료 적용의 복구 저널이 유효하지 않습니다.');
  const journal=value as unknown as ProjectRecoveryJournal;
  const manifestFile=await readProjectFile(`${root}/generation-manifest.json`,isCurrent);
  if(!manifestFile||manifestFile.revision!==journal.previousManifestRevision)throw Error('완료 적용의 manifest 백업 hash가 다릅니다.');
  const manifest=parseGenerationManifest(strictProjectText(manifestFile.bytes));
  if(manifest.protocol!==2||manifest.projects[journal.projectId]?.outputDir!==journal.projectRoot)throw Error('완료 적용의 이전 프로젝트 소유권이 다릅니다.');
  const files=journal.files.map(file=>{
    if(!exact(file,['path','ticketId','previousRevision','backupPath','writtenRevision'])||typeof file.path!=='string')throw Error('완료 적용의 파일 복구 범위가 유효하지 않습니다.');
    return {...file,previousEntry:manifest.entries[file.path]??null};
  });
  return {protocol:2,phase:'committed',runId,requestId:journal.requestId,createdAt:'reconstructed-from-prewrite-journal',files};
}

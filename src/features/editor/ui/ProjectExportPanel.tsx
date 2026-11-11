import { useEffect, useState } from 'react';
import { useEditorStore } from '@/features/editor/store/editorStore';
import { useDocumentStore } from '@/features/editor/store/documentStore';
import { useExportStore } from '@/features/editor/store/exportStore';
import { inspectProjectExport, downloadProjectBundle } from './projectExport';
import { openTicketPanel } from './openTicketPanel';

const STATES={current:'현재 프로젝트 전체 출력입니다.',partial:'일부 화면만 완료됐습니다. 나머지 티켓을 전달하세요.',stale:'입력 또는 이미지가 바뀌었습니다. 티켓을 다시 생성하세요.',unverified:'출력 소유권 또는 바이트를 확인할 수 없습니다.',missing:'프로젝트 수락 기록이 없습니다.'};
export function ProjectExportPanel() {
  const project=useEditorStore(state=>state.spec);const documentId=useEditorStore(state=>state.documentId);
  const identity=useDocumentStore(state=>state.projectIdentity);const fileName=useDocumentStore(state=>state.fileName);
  const [revision,setRevision]=useState(0);const [result,setResult]=useState<Awaited<ReturnType<typeof inspectProjectExport>>|null>(null);
  const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false);
  const current=()=>useEditorStore.getState().spec===project&&useEditorStore.getState().documentId===documentId&&useDocumentStore.getState().projectIdentity===identity;
  useEffect(()=>{
    let cancelled=false;setResult(null);setError(null);
    const isCurrent=()=>!cancelled&&useEditorStore.getState().spec===project&&useEditorStore.getState().documentId===documentId&&useDocumentStore.getState().projectIdentity===identity;
    void inspectProjectExport({project,fileName,documentId,isCurrent}).then(value=>{if(isCurrent())setResult(value);}).catch(reason=>{if(isCurrent())setError(String(reason instanceof Error?reason.message:reason));});
    return()=>{cancelled=true;};
  },[project,documentId,identity,fileName,revision]);
  const state=result?.evidence.inspection.state;
  async function download(){setBusy(true);setError(null);try{await downloadProjectBundle({project,fileName,documentId,isCurrent:current});}catch(reason){if(current())setError(reason instanceof Error?reason.message:String(reason));}finally{setBusy(false);}}
  return <aside className="flex flex-col overflow-auto border-l border-line bg-surface p-3 [grid-area:props]">
    <header className="flex gap-2"><h2 className="flex-1 text-sm font-semibold">프로젝트 코드 내보내기</h2><button type="button" aria-label="코드 내보내기 닫기" onClick={()=>useExportStore.getState().close()}>×</button></header>
    <p className="my-2 text-xs text-content-muted">{project.name} · 전체 화면과 모달</p>
    <p role="status" className="text-sm">{state?STATES[state]:error?'검사하지 못했습니다.':'프로젝트 전체 출력 검사 중…'}</p>
    {error&&<p role="alert" className="my-2 text-sm text-error">{error}</p>}
    {result&&<><p className="my-2 text-xs">파일 {result.files.length}개 · 참조 오류 {result.report.errorCount}건 · 미참조 widget {result.context.snapshot.plan.excludedPages.length}개</p>
      {result.report.issues.filter(issue=>issue.severity==='error').map((issue,index)=><p key={index} className="text-xs text-error">{issue.message}</p>)}
      <p className="text-xs text-content-muted">파일과 입력 지문 검사입니다. 실제 빌드·브라우저 검증은 별도로 필요합니다.</p></>}
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>setRevision(value=>value+1)} disabled={busy}>다시 검사</button>
      <button type="button" onClick={()=>void download()} disabled={busy||state!=='current'||!!result?.report.errorCount}>프로젝트 ZIP 다운로드</button>
      <button type="button" onClick={openTicketPanel} disabled={busy}>구현 티켓 열기</button></div>
  </aside>;
}

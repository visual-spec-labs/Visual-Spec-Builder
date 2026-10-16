// Project GUI request/accept/Export journey. Deterministic fixture agent, no real model.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startBrowserWorkspace } from './harness.mjs';
const workspace=await mkdtemp(join(tmpdir(),'vs-project-journey-'));let runner;
try {
  for(const dir of ['specs','runtime','generated/pages'])await mkdir(join(workspace,dir),{recursive:true});
  const project=JSON.parse(await readFile(new URL('../../test/fixtures/screen-relations-project.json',import.meta.url),'utf8'));
  project.name='RelationProject';await writeFile(join(workspace,'specs/relations.json'),JSON.stringify(project));
  const old='export default function Old(){return null}';await writeFile(join(workspace,'generated/pages/Old.tsx'),old);
  runner=await startBrowserWorkspace(workspace);const context=await runner.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(runner.url);
  await page.getByRole('button').filter({hasText:/RelationProject.*페이지/s}).click();await page.getByRole('button',{name:'파일',exact:true}).waitFor();
  await page.evaluate(async()=>{
    window.editor=(await import('/src/features/editor/store/editorStore.ts')).useEditorStore;
    window.tickets=(await import('/src/features/editor/store/ticketStore.ts')).useTicketStore;
    window.openTickets=(await import('/src/features/editor/ui/openTicketPanel.ts')).openTicketPanel;
  });
  const original=await page.evaluate(()=>editor.getState().spec);
  await page.getByRole('button',{name:'파일',exact:true}).click();await page.getByRole('menuitem',{name:'저장',exact:true}).click();
  await page.locator('[role="status"][aria-label="저장 상태"]').filter({hasText:'파일 저장됨'}).waitFor();
  assert.deepEqual(JSON.parse(await readFile(join(workspace,'specs/relations.json'),'utf8')),original,'save persists relations and project identity');
  await page.evaluate(()=>openTickets());
  assert.equal(await page.evaluate(()=>tickets.getState().projectPlan.version),'0.2');
  assert.ok(await page.evaluate(()=>tickets.getState().projectPlan.excludedPages.length>0));
  await page.getByRole('button',{name:'에이전트에 전달',exact:true}).click();
  const handled=new Set();let finished=false;
  for(let attempt=0;attempt<600;attempt++) {
    let request;try{request=JSON.parse(await readFile(join(workspace,'runtime/ticket-request.json'),'utf8'));}catch{}
    if(request&&!handled.has(request.id)) {
      assert.equal(request.protocol,4);assert.equal(request.project.projectId,original.projectId);handled.add(request.id);
      for(const ticket of request.tickets) {
        const screen=request.project.pages[ticket.sourcePageId];assert.notEqual(screen.kind,'widget');
        const actions=Object.values(screen.nodes).filter(node=>node.type==='button'&&node.action);
        const body=actions.map(node=>{const action=node.action;const callback=action.type==='navigate'?`onNavigate(${JSON.stringify(action.target)})`:action.type==='openModal'?`onOpenModal(${JSON.stringify(action.target)})`:'onClose()';return `<button onClick={()=>${callback}}>{${JSON.stringify(node.content)}}</button>`;}).join('');
        const source=ticket.kind==='page'?`export default function ${ticket.componentName}({onNavigate,onOpenModal,onClose}:{onNavigate:(id:string)=>void;onOpenModal:(id:string)=>void;onClose:()=>void}){return <main>${body}</main>}`:`export function ${ticket.componentName}(){return <div/>}`;
        const path=join(workspace,ticket.outputPath);await mkdir(dirname(path),{recursive:true});await writeFile(path,source);
      }
      const response=JSON.stringify({protocol:4,requestId:request.id,results:request.tickets.map(ticket=>({ticketId:ticket.id,status:'done'}))});
      await writeFile(join(workspace,'runtime/fixture-response.tmp'),response);await rename(join(workspace,'runtime/fixture-response.tmp'),join(workspace,'runtime/ticket-response.json'));
    }
    const state=await page.evaluate(()=>({running:tickets.getState().running,error:tickets.getState().runError,done:tickets.getState().tickets.every(ticket=>ticket.status==='done')}));
    if(!state.running&&handled.size){assert.equal(state.error,null);assert.equal(state.done,true);finished=true;break;}
    await delay(100);
  }
  assert.ok(finished,'fixture project waves complete');assert.ok(handled.size>1);
  await page.getByRole('button',{name:'파일',exact:true}).click();await page.getByRole('menuitem',{name:'코드 내보내기',exact:true}).click();
  await page.getByText('현재 프로젝트 전체 출력입니다.',{exact:true}).waitFor();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'프로젝트 ZIP 다운로드',exact:true}).click();const download=await downloadPromise;
  const downloaded=join(workspace,'fixture.zip');await download.saveAs(downloaded);const zip=await readFile(downloaded);const raw=zip.toString('utf8');
  assert.ok(raw.includes('/runtime/Entry.tsx'));assert.ok(raw.includes('/resetPassword/pages/'));assert.ok(raw.includes('onNavigate("dashboard")'));assert.ok(raw.includes('onOpenModal("resetPassword")'));
  assert.deepEqual(await page.evaluate(()=>editor.getState().spec),original,'generation/export preserve IR and identity');
  assert.equal(await readFile(join(workspace,'generated/pages/Old.tsx'),'utf8'),old,'unowned legacy output preserved');
  await page.reload();
  await page.getByRole('button').filter({hasText:/RelationProject.*페이지/s}).click();await page.getByRole('button',{name:'파일',exact:true}).waitFor();
  const reopened=await page.evaluate(async()=>(await import('/src/features/editor/store/editorStore.ts')).useEditorStore.getState().spec);
  assert.deepEqual(reopened,original,'reopen retains IR and the accepted project identity');
  await page.getByRole('button',{name:'파일',exact:true}).click();await page.getByRole('menuitem',{name:'코드 내보내기',exact:true}).click();
  await page.getByText('현재 프로젝트 전체 출력입니다.',{exact:true}).waitFor();
  // A manual edit invalidates the next scan instead of being silently included.
  const manifest=JSON.parse(await readFile(join(workspace,'runtime/generation-manifest.json'),'utf8'));const target=Object.keys(manifest.entries)[0];await writeFile(join(workspace,'generated',target),'manual later bytes');
  await page.getByRole('button',{name:'다시 검사',exact:true}).click();await page.getByText('출력 소유권 또는 바이트를 확인할 수 없습니다.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'프로젝트 ZIP 다운로드',exact:true}).isDisabled(),true);assert.deepEqual(errors,[]);
  console.log('PASS fixture v4 waves, acceptance, project ZIP pages/modals/runtime/action callbacks, unchanged IR and manual-byte rejection; no real AI or exported-app visual claim');
} finally {try{await runner?.close();}finally{await rm(workspace,{recursive:true,force:true});}}

// Fixture agent + actual HTTP lease loss, browser reload, explicit discovery/recovery. No model.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, rename, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startBrowserWorkspace } from './harness.mjs';
const workspace=await mkdtemp(join(tmpdir(),'vs-pending-recovery-'));let runner;
try {
  await mkdir(join(workspace,'specs'),{recursive:true});
  const project=JSON.parse(await readFile(new URL('../../test/fixtures/screen-relations-project.json',import.meta.url),'utf8'));
  project.name='RecoveryProject';await writeFile(join(workspace,'specs/recovery.json'),JSON.stringify(project));
  runner=await startBrowserWorkspace(workspace);const context=await runner.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const open=async()=>{await page.getByRole('button').filter({hasText:/RecoveryProject.*페이지/s}).click();await page.getByRole('button',{name:'파일',exact:true}).waitFor();};
  const tickets=async()=>page.evaluate(async()=>{window.tickets=(await import('/src/features/editor/store/ticketStore.ts')).useTicketStore;(await import('/src/features/editor/ui/openTicketPanel.ts')).openTicketPanel();});
  await page.goto(runner.url);await open();
  await page.getByRole('button',{name:'파일',exact:true}).click();await page.getByRole('menuitem',{name:'저장',exact:true}).click();
  await page.locator('[role="status"][aria-label="저장 상태"]').filter({hasText:'파일 저장됨'}).waitFor();
  const savedSpec=await readFile(join(workspace,'specs/recovery.json'),'utf8');
  await tickets();await page.getByRole('button',{name:'에이전트에 전달',exact:true}).click();
  let request;
  for(let count=0;count<200&&!request;count++){try{request=JSON.parse(await readFile(join(workspace,'runtime/ticket-request.json'),'utf8'));}catch{await delay(50);}}
  assert.equal(request.protocol,4);const manifestBefore=await readFile(join(workspace,'runtime/generation-manifest.json'),'utf8');
  await page.evaluate(async id=>{
    const client=await import('/src/features/editor/ui/workspaceClient.ts');const original=window.fetch.bind(window);let lost=false;
    window.fetch=async(...args)=>{const response=await original(...args);if(!lost&&args[1]?.method==='PUT'&&String(args[0]).includes('/generated/')){lost=true;await client.releaseRequestLock('ticket',id);}return response;};
  },request.id);
  for(const ticket of request.tickets){const path=join(workspace,ticket.outputPath);await mkdir(dirname(path),{recursive:true});await writeFile(path,`export ${ticket.kind==='page'?'default ':''}function ${ticket.componentName}(){return <div/>}`);}
  const response=JSON.stringify({protocol:4,requestId:request.id,results:request.tickets.map(ticket=>({ticketId:ticket.id,status:'done'}))});
  await writeFile(join(workspace,'runtime/response.tmp'),response);await rename(join(workspace,'runtime/response.tmp'),join(workspace,'runtime/ticket-response.json'));
  await page.waitForFunction(()=>!tickets.getState().running&&tickets.getState().lastProjectRun!==null);
  const markerPath=join(workspace,`runtime/project-generation-${createHash('sha256').update(request.project.projectId).digest('hex')}.json`);
  assert.equal(JSON.parse(await readFile(markerPath,'utf8')).phase,'pending');
  await page.reload();await open();await tickets();
  assert.equal(await page.evaluate(()=>tickets.getState().lastProjectRun),null,'reload lost the in-memory handle');
  await page.getByRole('button',{name:'미완료 적용 확인',exact:true}).click();
  await page.getByText('미완료 프로젝트 적용을 찾았습니다. 되돌리기를 누르면 파일 전체를 다시 확인한 뒤 복구합니다.',{exact:true}).waitFor();
  assert.equal(JSON.parse(await readFile(markerPath,'utf8')).phase,'pending','discovery is read-only');
  await page.getByRole('button',{name:'마지막 프로젝트 적용 되돌리기',exact:true}).click();
  await page.getByText('프로젝트의 마지막 적용을 되돌렸습니다. 티켓을 다시 생성하세요.',{exact:true}).waitFor();
  await assert.rejects(access(markerPath));
  for(const ticket of request.tickets)await assert.rejects(access(join(workspace,'generated',ticket.filePath)));
  assert.equal(await readFile(join(workspace,'runtime/generation-manifest.json'),'utf8'),manifestBefore);
  assert.equal(await readFile(join(workspace,'specs/recovery.json'),'utf8'),savedSpec);assert.deepEqual(errors,[]);
  console.log('PASS fixture server lease loss → pending → reload → read-only discovery → explicit fresh-lease recovery; original IR/manifest retained; no real AI');
}finally{try{await runner?.close();}finally{await rm(workspace,{recursive:true,force:true});}}

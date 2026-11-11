// S2 NL request context and G3 acceptance; fixture response, no model invocation.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startBrowserWorkspace, writeFileAtomic } from './harness.mjs';
const workspace=await mkdtemp(join(tmpdir(),'vs-nl-widgets-'));
let runner;
try {
  for(const dir of ['specs','runtime','generated'])await mkdir(join(workspace,dir),{recursive:true});
  const project=JSON.parse(await readFile(new URL('../../test/fixtures/screen-relations-project.json',import.meta.url),'utf8'));
  project.name='Widget NL Flow';
  project.pages.login.nodes.shared={type:'instance',name:'Shared',box:{width:200,height:80},ref:'notificationWidget'};
  project.pages.login.nodes.root.children.push({node:'shared'});
  const root=project.pages.login.nodes.root;
  project.pages.login.nodes.card={...structuredClone(root),name:'Card',box:{width:200,height:100},children:[]};
  root.children.push({node:'card'});
  await writeFile(join(workspace,'specs/flow.json'),JSON.stringify(project));
  runner=await startBrowserWorkspace(workspace);
  const context=await runner.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(runner.url);
  await page.getByRole('button').filter({hasText:/Widget NL Flow.*페이지/s}).click();
  await page.evaluate(async()=>{window.editor=(await import('/src/features/editor/store/editorStore.ts')).useEditorStore;editor.getState().select('shared');});
  const prompt=page.getByRole('textbox',{name:'자연어 편집 요청',exact:true});
  await prompt.fill('선택한 위젯 제목을 Custom으로 바꿔 줘');await prompt.press('Enter');
  let req;
  for(let i=0;i<250;i++){
    try{req=JSON.parse(await readFile(join(workspace,'runtime/nl-request.json'),'utf8'));break;}catch(error){if(error.code!=='ENOENT')throw error;}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.ok(req);assert.equal(req.protocol,2);assert.equal(req.scope.nodeId,'shared');
  assert.deepEqual(req.widgets.map(item=>item.pageId),['notificationWidget']);
  assert.equal(req.widgets[0].screen.nodes.title.content,'새 알림');
  const before=await page.evaluate(()=>editor.getState().spec);
  const command={type:'updateNode',id:'shared',path:'overrides',value:{title:{content:'Custom'}}};
  await writeFileAtomic(join(workspace,'runtime/nl-response.json'),JSON.stringify({protocol:req.protocol,commandVersion:req.commandVersion,requestId:req.id,commands:[command]}));
  await page.waitForFunction(()=>editor.getState().spec.pages.login.nodes.shared.overrides?.title?.content==='Custom');
  assert.equal(await page.evaluate(()=>editor.getState().history.past.length),1);
  await page.evaluate(()=>editor.getState().undo());
  assert.deepEqual(await page.evaluate(()=>editor.getState().spec),before);
  await page.evaluate(()=>editor.getState().select('card'));
  await prompt.fill('이 카드를 위젯으로 만들어서 대시보드에도 넣어 줘');await prompt.press('Enter');
  let next;
  for(let i=0;i<250;i++){
    try{
      next=JSON.parse(await readFile(join(workspace,'runtime/nl-request.json'),'utf8'));
      if(next.id!==req.id)break;
    }catch(error){if(error.code!=='ENOENT')throw error;}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.ok(next?.id!==req.id);assert.equal(next.scope.nodeId,'card');
  assert.ok(next.destinations.some(item=>item.pageId==='dashboard'&&item.kind==='page'));
  const projectCommand={version:'0.1',type:'extractAndPlaceWidget',pageId:'login',nodeId:'card',widgetId:'sharedCard',name:'Shared card',targetPageId:'dashboard'};
  await page.evaluate(()=>editor.getState().select('title'));
  await writeFileAtomic(join(workspace,'runtime/nl-response.json'),JSON.stringify({protocol:next.protocol,commandVersion:next.commandVersion,requestId:next.id,projectCommand}));
  await page.getByText('위젯 명령의 원본 요소가 요청 범위와 다릅니다.').waitFor();
  assert.deepEqual(await page.evaluate(()=>editor.getState().spec),before);
  await page.evaluate(()=>editor.getState().select('card'));
  await prompt.fill('이 카드를 위젯으로 만들어서 대시보드에도 넣어 줘');await prompt.press('Enter');
  let retry;
  for(let i=0;i<250;i++){
    try{
      retry=JSON.parse(await readFile(join(workspace,'runtime/nl-request.json'),'utf8'));
      if(retry.id!==next.id)break;
    }catch(error){if(error.code!=='ENOENT')throw error;}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.ok(retry?.id!==next.id);
  await writeFileAtomic(join(workspace,'runtime/nl-response.json'),JSON.stringify({protocol:retry.protocol,commandVersion:retry.commandVersion,requestId:retry.id,projectCommand}));
  await page.waitForFunction(()=>editor.getState().spec.pages.login.nodes.card.type==='instance');
  const after=await page.evaluate(()=>editor.getState().spec);
  assert.equal(after.pages.sharedCard.kind,'widget');
  assert.equal(Object.values(after.pages.dashboard.nodes).filter(node=>node.type==='instance'&&node.ref==='sharedCard').length,1);
  assert.equal(await page.evaluate(()=>editor.getState().history.past.length),1);
  await page.evaluate(()=>editor.getState().undo());
  assert.deepEqual(await page.evaluate(()=>editor.getState().spec),before);
  assert.deepEqual(errors,[]);
  console.log('PASS S2 NL widget context, override and cross-page extraction, atomic Undo; fixture response only');
} finally {try{await runner?.close();}finally{await rm(workspace,{recursive:true,force:true});}}

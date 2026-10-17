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
  assert.deepEqual(errors,[]);
  console.log('PASS S2 NL widget source context, G3 override, Undo; fixture response only');
} finally {try{await runner?.close();}finally{await rm(workspace,{recursive:true,force:true});}}

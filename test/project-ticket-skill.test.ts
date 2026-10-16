import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import * as React from 'react';
import { rewriteProjectAssetModule } from '@/features/editor/export/projectAssetModules';
import { parseProjectTicketResponse, type ProjectTicketRequest } from '@/features/editor/ticket/projectTicketProtocol';

const source=readFileSync(new URL('../skills/visual-spec-ticket-response/examples/Screen.tsx',import.meta.url),'utf8');
const contract=readFileSync(new URL('../skills/visual-spec-ticket-response/PROJECT_V4.md',import.meta.url),'utf8');
const hashes=['a'.repeat(64),'b'.repeat(64)];

describe('shipped project skill executable examples (not AI execution)',()=>{
  it('parses both shipped response examples with ticketId and rejects the ambiguous request-side id key',()=>{
    const request:Pick<ProjectTicketRequest,'id'|'tickets'>={id:'v4-example',tickets:[{id:'home:Home',sourcePageId:'home',componentName:'Home',kind:'page',instances:['root'],filePath:'my-app/home/pages/Home.tsx',outputPath:'staging/v4-example/my-app/home/pages/Home.tsx'}]};
    const examples=[...contract.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match=>JSON.parse(match[1]));
    expect(examples).toHaveLength(2);
    for(const response of examples){
      expect(parseProjectTicketResponse(JSON.stringify(response),request).kind).toBe('results');
      const wrong={...response,results:response.results.map((item:{ticketId:string;status:string;message?:string})=>({id:item.ticketId,status:item.status,...(item.message?{message:item.message}:{})}))};
      expect(parseProjectTicketResponse(JSON.stringify(wrong),request).kind).toBe('malformed');
    }
  });
  it('rejects callback-only JSX spreads as the procedure now explicitly requires',async()=>{
    await expect(rewriteProjectAssetModule({source:'export default function Screen(props:object){return <Card {...props}/>}',modulePath:'home/pages/Home.tsx',ownedModulePaths:['home/pages/Home.tsx'],assets:[]})).rejects.toThrow(/spread/);
    expect(contract).toContain('모든 JSX prop spread도 금지');
  });
  it('forwards each concrete IR action through the Host callbacks and keeps both static image variants',()=>{
    const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React, target:ts.ScriptTarget.ES2022}}).outputText;
    const exported:Record<string,(props:Record<string,unknown>)=>React.ReactElement>= {};
    new Function('exports','React',compiled)(exported,React);
    const actions={onNavigate:vi.fn(),onOpenModal:vi.fn(),onClose:vi.fn()};
    const screen=exported.default(actions);
    const children=(screen.props as {children:React.ReactElement<{onClick:()=>void}>[]}).children;
    children[0].props.onClick();children[1].props.onClick();children[2].props.onClick();
    expect(actions.onNavigate).toHaveBeenCalledWith('dashboard');
    expect(actions.onOpenModal).toHaveBeenCalledWith('resetPassword');expect(actions.onClose).toHaveBeenCalledOnce();
    expect((exported.Photo({variant:'first'}).props as {src:string}).src).toBe(`vsb-asset:${hashes[0]}`);
    expect((exported.Photo({variant:'second'}).props as {src:string}).src).toBe(`vsb-asset:${hashes[1]}`);
  });
  it('passes both static variants through the real asset AST gate; dynamic image props remain rejected',async()=>{
    const options={modulePath:'login/pages/Screen.tsx',ownedModulePaths:['login/pages/Screen.tsx'],assets:hashes.map(sha256=>({sourcePath:`assets/${sha256}.png`,sha256,byteLength:1,mediaType:'image/png' as const,zipPath:`assets/${sha256}.png`}))};
    const result=await rewriteProjectAssetModule({...options,source});
    expect(result.usedAssets).toHaveLength(2);expect(result.code).not.toContain('src="vsb-asset:');
    expect(result.code).toContain('new URL("../../assets/');
    await expect(rewriteProjectAssetModule({...options,source:'export default function Photo({src}:{src:string}) { return <img src={src}/>; }'})).rejects.toThrow();
  });
  it('names the actual action discriminator and fields, and separates GUI-only writes',()=>{
    expect(contract).toContain('action: { type: "navigate", target }');
    expect(contract).toContain('action: { type: "openModal", target }');
    expect(contract).toContain('action: { type: "close" }');
    expect(contract).not.toContain('targetPageId');expect(contract).not.toContain('closeModal');
    expect(contract).toContain('plan.artifacts의 Routes.ts/Host.tsx/Entry.tsx는 GUI 소유');
  });
});

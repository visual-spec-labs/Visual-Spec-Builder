import type { ProjectSpec } from '@/features/editor/schema';
import { compileProjectTickets } from '@/features/editor/ticket/compileProjectTickets';
import { GENERATION_MANIFEST_PATH, isReadableGenerationManifest, parseGenerationManifest } from '@/features/editor/export/generationManifest';
import { bundleFileName, bundleFolderName, buildPackageJson } from '@/features/editor/export/bundle';
import { createZip, utf8Bytes, type ZipEntry } from '@/features/editor/export/zip';
import { verifyGenerated } from '@/features/editor/export/verifyGenerated';
import { validateProjectModuleImports } from '@/features/editor/export/projectModuleImports';
import { findGenerationProject } from './generationTarget';
import { readCurrentProjectContext, readProjectFile, readProjectGenerationEvidence, strictProjectText } from './projectGenerationWorkspace';

export interface ProjectExportInput {project:ProjectSpec;fileName:string|null;documentId:number;isCurrent:()=>boolean}
export async function inspectProjectExport(input:ProjectExportInput) {
  const project=structuredClone(input.project);const plan=compileProjectTickets(project);
  const manifestFile=await readProjectFile(GENERATION_MANIFEST_PATH,input.isCurrent);
  const text=manifestFile?strictProjectText(manifestFile.bytes):null;
  if(!isReadableGenerationManifest(text))throw Error('프로젝트 생성 기록을 확인하지 못했습니다.');
  const owner=findGenerationProject(parseGenerationManifest(text),{projectId:project.projectId,fileName:input.fileName,documentId:input.documentId});
  if(!owner||owner.projectId!==project.projectId)throw Error('프로젝트 생성 자리가 없습니다. 구현 티켓을 전달하세요.');
  const context=await readCurrentProjectContext({requestId:`export-${crypto.randomUUID()}`,project,plan,projectRoot:owner.outputDir,isCurrent:input.isCurrent});
  const evidence=await readProjectGenerationEvidence(context,input.isCurrent);
  const files=context.outputs.flatMap(output=>{
    const file=evidence.files.get(output.filePath);return file?[{path:output.filePath.slice(owner.outputDir.length+1),content:strictProjectText(file)}]:[];
  });
  const report=verifyGenerated({files,tickets:[],assetNames:context.snapshot.assets.map(asset=>asset.zipPath.slice('assets/'.length))});
  const packages=new Set(report.packages);
  const owned=context.outputs.filter(output=>output.scope==='page').map(output=>output.filePath.slice(owner.outputDir.length+1));
  if(evidence.inspection.state==='current')for(const file of files)if(owned.includes(file.path))await validateProjectModuleImports(file.content,file.path,owned,name=>packages.add(name));
  report.packages=[...packages].sort();
  return {context,evidence,files,report};
}

/** Always rescan at download time; cached UI success is not export authority. */
export async function prepareProjectBundle(input:ProjectExportInput):Promise<{zip:Uint8Array<ArrayBuffer>;filename:string}> {
  const checked=await inspectProjectExport(input);
  if(checked.evidence.inspection.state!=='current')throw Error('프로젝트 전체 출력이 현재 상태로 확인되지 않아 내보내지 않았습니다.');
  if(checked.report.errorCount)throw Error('생성 코드의 파일 참조 오류를 먼저 해결하세요.');
  const folder=bundleFolderName(input.project.name);
  const entries:ZipEntry[]=checked.files.map(file=>({path:`${folder}/${file.path}`,bytes:utf8Bytes(file.content)}));
  const assets=new Map<string,Uint8Array>();
  for(const asset of checked.context.snapshot.assets) {
    if(assets.has(asset.zipPath))continue;
    assets.set(asset.zipPath,Uint8Array.from(atob(asset.dataBase64),character=>character.charCodeAt(0)));
  }
  for(const [path,bytes] of assets)entries.push({path:`${folder}/${path}`,bytes});
  entries.push({path:`${folder}/package.json`,bytes:utf8Bytes(buildPackageJson(input.project.name,checked.report.packages))});
  entries.push({path:`${folder}/README.md`,bytes:utf8Bytes(`# ${input.project.name}\n\n프로젝트 전체 화면과 모달, GUI runtime, 검증한 이미지 bytes를 포함합니다.\n\n진입점: runtime/Entry.tsx. React와 Tailwind 환경에 통합하고 package.json 의존성을 확인하세요.\n\n파일/참조/입력 지문 검사는 실제 typecheck, production build, 브라우저 시각 검증을 대신하지 않습니다.\n재사용 widget ${checked.context.snapshot.plan.excludedPages.length}개는 생성 범위에서 제외했습니다.\n`)});
  const zip=createZip(entries);
  const current=await readCurrentProjectContext({requestId:checked.context.snapshot.requestId,project:input.project,plan:checked.context.snapshot.plan,projectRoot:checked.context.projectRoot,isCurrent:input.isCurrent});
  if(current.fingerprints.project!==checked.context.fingerprints.project||!input.isCurrent())throw Error('내보내기 중 프로젝트 또는 이미지가 바뀌었습니다. 다시 검사하세요.');
  return {zip,filename:bundleFileName(input.project.name)};
}

export async function downloadProjectBundle(input:ProjectExportInput):Promise<void> {
  const bundle=await prepareProjectBundle(input);if(!input.isCurrent())return;
  const url=URL.createObjectURL(new Blob([bundle.zip],{type:'application/zip'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=bundle.filename;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),0);
}

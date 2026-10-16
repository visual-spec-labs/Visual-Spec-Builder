import type { ProjectSpec } from '@/features/editor/schema';
import type { ProjectPlan } from '@/features/editor/ticket/types';
import { validateProjectPlan } from '@/features/editor/ticket/validate';
import { validateProjectPlanContext } from '@/features/editor/ticket/compileProjectTickets';
import { assertProjectOutputPaths } from '@/features/editor/ticket/projectTicketProtocol';
import { createProjectAssetSnapshot, projectAssetPaths } from '@/features/editor/ticket/projectInputSnapshot';
import { generatedTicketPath } from '@/features/editor/export/generationIdentity';
import { projectGenerationPath } from '@/features/editor/export/projectGenerationIdentity';
import { inspectProjectGeneration, projectProvenanceContext, type ProjectProvenanceContext, type ProjectGenerationProvenance } from '@/features/editor/export/projectGenerationProvenance';
import { GENERATION_MANIFEST_PATH, isReadableGenerationManifest, parseGenerationManifest } from '@/features/editor/export/generationManifest';
import { WORKSPACE_MAX_BODY_BYTES } from '@/features/workspace/protocol';
import { readWorkspaceFileSnapshot } from './workspaceClient';

export const strictProjectText = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
export async function readProjectFile(path: string, isCurrent: () => boolean = () => true) {
  if (!isCurrent()) throw Error('프로젝트 작업이 취소되거나 문서 세대가 바뀌었습니다.');
  const read = await readWorkspaceFileSnapshot(path);
  if (!isCurrent()) throw Error('프로젝트 작업이 취소되거나 문서 세대가 바뀌었습니다.');
  if (!read.ok) throw Error(`프로젝트 파일을 읽지 못했습니다: ${path}`);
  return read.snapshot;
}

/** Current external asset bytes are part of the input, even if no editor event occurred. */
export async function readCurrentProjectContext(args: {
  requestId: string; project: ProjectSpec; plan: ProjectPlan; projectRoot: string; isCurrent: () => boolean;
}) {
  const { requestId, projectRoot, isCurrent } = args;
  const project = structuredClone(args.project); const plan = structuredClone(args.plan);
  const valid = validateProjectPlanContext(plan, project);
  if (!valid.valid) throw Error(valid.issues.map(issue => issue.message).join('\n'));
  const assets = [];
  for (const path of projectAssetPaths(project)) {
    const file = await readProjectFile(path, isCurrent);
    if (!file) throw Error(`프로젝트 자산이 없습니다: ${path}`);
    assets.push(createProjectAssetSnapshot(path, file.bytes));
  }
  if (!isCurrent()) throw Error('프로젝트 작업이 취소되었습니다.');
  return projectProvenanceContext({ protocol: 1, requestId, projectId: project.projectId!, project, plan, assets }, projectRoot);
}

/** Read historical paths only after deriving them from a validated plan in the owned root. */
export async function readProjectGenerationEvidence(input: ProjectProvenanceContext, isCurrent: () => boolean = () => true) {
  const context = projectProvenanceContext(input.snapshot, input.projectRoot);
  const manifestFile = await readProjectFile(GENERATION_MANIFEST_PATH, isCurrent);
  const manifestText = manifestFile ? strictProjectText(manifestFile.bytes) : null;
  if (!isReadableGenerationManifest(manifestText)) throw Error('생성 manifest가 손상되거나 지원하지 않는 버전입니다.');
  const manifest = parseGenerationManifest(manifestText);
  if (manifest.protocol !== 2 || manifest.projects[context.snapshot.projectId]?.outputDir !== context.projectRoot) throw Error('프로젝트 생성 폴더의 소유권을 확인하지 못했습니다.');
  const sidecarPath = projectGenerationPath(context.snapshot.projectId);
  const sidecarFile = await readProjectFile(sidecarPath, isCurrent);
  const text = sidecarFile ? strictProjectText(sidecarFile.bytes) : null;
  const paths = new Set(context.outputs.map(output => output.filePath));
  let historical: ProjectGenerationProvenance | null = null;
  // This only derives a read allow-list. The complete closed-shape, bytes and manifest
  // evidence is still validated below by the existing inspector, never by this cast.
  if (text !== null && sidecarFile!.bytes.byteLength <= WORKSPACE_MAX_BODY_BYTES) {
    try {
      const candidate = JSON.parse(text);
      if (candidate?.projectId === context.snapshot.projectId && candidate?.projectRoot === context.projectRoot && validateProjectPlan(candidate.plan).valid) {
        assertProjectOutputPaths(candidate.plan, context.projectRoot);
        historical = candidate;
        for (const ticket of historical!.plan.tickets) paths.add(generatedTicketPath(`${context.projectRoot}/${ticket.sourcePageId}`, ticket));
        for (const artifact of historical!.plan.artifacts) paths.add(`${context.projectRoot}/${artifact.filePath}`);
      }
    } catch { /* Inspector reports unverified; never use corrupt output paths for reads. */ }
  }
  const snapshots = new Map<string, Awaited<ReturnType<typeof readProjectFile>>>();
  const files = new Map<string, Uint8Array>();
  for (const path of paths) {
    const file = await readProjectFile(`generated/${path}`, isCurrent); snapshots.set(path, file);
    if (file) files.set(path, file.bytes);
  }
  const inspection = inspectProjectGeneration({ text, context, files, manifest });
  const record = inspection.state === 'current' || inspection.state === 'partial' ? inspection.record
    : inspection.state === 'stale' ? historical : null;
  return { context, manifest, manifestFile, sidecarPath, sidecarFile, inspection, record, snapshots, files };
}

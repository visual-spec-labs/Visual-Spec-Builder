import { WORKSPACE_MAX_BODY_BYTES } from "@/features/workspace/protocol";
import type { ProjectPlan } from "@/features/editor/ticket/types";
import { validateProjectPlan } from "@/features/editor/ticket/validate";
import { buildProjectInputSnapshot, createProjectAssetSnapshot, type ProjectInputSnapshot, type ProjectAssetSnapshot } from "@/features/editor/ticket/projectInputSnapshot";
import { buildProjectTicketRequest } from "@/features/editor/ticket/projectTicketProtocol";
import { canonicalJson, sha256Hex } from "./contentHash";
import { generatedTicketPath, ticketComponentKey } from "./generationIdentity";
import type { GenerationManifest } from "./generationManifest";
import { PROJECT_TEMPLATE_VERSION, projectGenerationFingerprints, structuralProjectPlan } from "./projectGenerationIdentity";

export interface ProjectOutputProvenance {
  id: string; scope: "page" | "project"; sourcePageId?: string; filePath: string;
  sha256: string; requestId: string; inputFingerprint: string;
}
export interface ProjectGenerationProvenance {
  protocol: 1; projectId: string; projectRoot: string; plan: ProjectPlan; templateVersion: string;
  inputFingerprint: string; assets: ProjectAssetSnapshot[]; outputs: ProjectOutputProvenance[]; committedRunId: string;
}
type ExpectedOutput = Omit<ProjectOutputProvenance, "sha256" | "requestId">;
export function projectProvenanceContext(inputSnapshot: ProjectInputSnapshot, projectRoot: string) {
  if (inputSnapshot.protocol !== 1 || inputSnapshot.projectId !== inputSnapshot.project.projectId) throw Error("입력 snapshot 신원이 다릅니다.");
  const input = buildProjectInputSnapshot(inputSnapshot.requestId, inputSnapshot.project, inputSnapshot.plan, inputSnapshot.assets);
  const snapshot = JSON.parse(input.content) as ProjectInputSnapshot;
  // Reuse the wire boundary's complete output-path collision/Windows checks.
  const leaf = snapshot.plan.tickets.find(ticket => ticket.dependsOn.length === 0);
  if (!leaf) throw Error("프로젝트 생성 계획에 시작 티켓이 없습니다.");
  buildProjectTicketRequest({ requestId: snapshot.requestId, projectRoot, snapshotContent: input.content,
    snapshotSha256: input.sha256, ticketIds: [leaf.id] });
  const fingerprints = projectGenerationFingerprints(snapshot);
  const outputs: ExpectedOutput[] = snapshot.plan.tickets.map(ticket => ({ id: ticket.id, scope: "page",
    sourcePageId: ticket.sourcePageId, filePath: generatedTicketPath(`${projectRoot}/${ticket.sourcePageId}`, ticket),
    inputFingerprint: fingerprints.pages[ticket.sourcePageId] }));
  outputs.push(...snapshot.plan.artifacts.map(artifact => ({ id: artifact.id, scope: "project" as const,
    filePath: `${projectRoot}/${artifact.filePath}`, inputFingerprint: fingerprints.project })));
  return { snapshot, projectRoot, fingerprints, outputs };
}
export type ProjectProvenanceContext = ReturnType<typeof projectProvenanceContext>;
const hashPattern = /^[a-f0-9]{64}$/;
const requestPattern = /^[A-Za-z0-9_-]{1,128}$/;
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
export type ProjectGenerationInspection = { state: "current" | "partial"; record: ProjectGenerationProvenance; missingIds: string[] }
  | { state: "unverified" | "stale"; reason: string };

/** Read-only verdict. Missing/corrupt/old records never manufacture ownership or mutate files. */
export function inspectProjectGeneration(args: {
  text: string | null; context: ProjectProvenanceContext; files: ReadonlyMap<string, Uint8Array>; manifest: GenerationManifest | null;
}): ProjectGenerationInspection {
  const unverified = (reason: string): ProjectGenerationInspection => ({ state: "unverified", reason });
  try {
    if (args.text === null) return unverified("프로젝트 수용 기록이 없습니다.");
    if (args.text.length > WORKSPACE_MAX_BODY_BYTES || new TextEncoder().encode(args.text).byteLength > WORKSPACE_MAX_BODY_BYTES) return unverified("수용 기록이 저장 크기 한도를 초과합니다.");
    const value: unknown = JSON.parse(args.text);
    if (!exact(value, ["protocol", "projectId", "projectRoot", "plan", "templateVersion", "inputFingerprint", "assets", "outputs", "committedRunId"])
      || value.protocol !== 1 || typeof value.projectId !== "string" || typeof value.projectRoot !== "string"
      || typeof value.templateVersion !== "string" || typeof value.inputFingerprint !== "string" || !hashPattern.test(value.inputFingerprint)
      || typeof value.committedRunId !== "string" || !requestPattern.test(value.committedRunId)
      || !Array.isArray(value.assets) || !Array.isArray(value.outputs) || !validateProjectPlan(value.plan).valid) return unverified("수용 기록 형태/버전을 확인할 수 없습니다.");
    const record = value as unknown as ProjectGenerationProvenance;
    if (record.plan.projectId !== record.projectId) return unverified("계획 프로젝트 신원이 다릅니다.");
    let previousSource: string | undefined;
    for (const asset of record.assets) {
      if (!exact(asset, ["sourcePath", "sha256", "byteLength", "mediaType", "zipPath", "dataBase64"])
        || typeof asset.sourcePath !== "string" || typeof asset.dataBase64 !== "string"
        || (previousSource !== undefined && asset.sourcePath <= previousSource)) return unverified("자산 기록 형태/정렬이 잘못됐습니다.");
      previousSource = asset.sourcePath;
      const actual = createProjectAssetSnapshot(asset.sourcePath, Uint8Array.from(atob(asset.dataBase64), character => character.charCodeAt(0)));
      if (canonicalJson(actual) !== canonicalJson(asset)) return unverified("보존 자산 바이트와 기록이 다릅니다.");
    }
    const { context, files, manifest } = args;
    if (record.projectId !== context.snapshot.projectId || record.projectRoot !== context.projectRoot) return unverified("프로젝트/생성 폴더 소유권이 다릅니다.");
    const expected = new Map(context.outputs.map(output => [output.id, output]));
    const seen = new Set<string>();
    for (const output of record.outputs) {
      const keys = ["id", "scope", "filePath", "sha256", "requestId", "inputFingerprint"];
      if (output?.scope === "page") keys.push("sourcePageId");
      if (!exact(output, keys) || typeof output.id !== "string" || seen.has(output.id)
        || typeof output.sha256 !== "string" || !hashPattern.test(output.sha256)
        || typeof output.inputFingerprint !== "string" || !hashPattern.test(output.inputFingerprint)
        || typeof output.requestId !== "string" || !requestPattern.test(output.requestId)) return unverified("출력 수용 기록이 손상되거나 중복됩니다.");
      seen.add(output.id);
      const target = expected.get(output.id);
      if (!target || output.scope !== target.scope || output.sourcePageId !== target.sourcePageId || output.filePath !== target.filePath) return unverified("계획 밖 출력 또는 출처/경로 불일치입니다.");
      const bytes = files.get(output.filePath);
      if (!bytes || sha256Hex(bytes) !== output.sha256) return unverified("생성 파일이 없거나 수용 뒤 변경됐습니다.");
      if (output.scope === "page") {
        const entry = manifest?.entries[output.filePath];
        const ticket = context.snapshot.plan.tickets.find(ticket => ticket.id === output.id)!;
        if (manifest?.protocol !== 2 || manifest.projects[record.projectId]?.outputDir !== record.projectRoot
          || !entry || entry.ticketProtocol !== 4 || entry.projectId !== record.projectId || entry.pageId !== output.sourcePageId
          || entry.ticketId !== output.id || entry.requestId !== output.requestId || entry.contentHash !== `sha256:${output.sha256}`
          || entry.inputFingerprint !== output.inputFingerprint || entry.componentKey !== ticketComponentKey(ticket)
          || entry.componentName !== ticket.componentName || entry.inputScope !== "page") return unverified("기존 manifest와 프로젝트 수용 기록이 다릅니다.");
      }
    }
    if (record.templateVersion !== PROJECT_TEMPLATE_VERSION || record.inputFingerprint !== context.fingerprints.project
      || canonicalJson(structuralProjectPlan(record.plan)) !== canonicalJson(structuralProjectPlan(context.snapshot.plan))
      || canonicalJson(record.assets) !== canonicalJson(context.snapshot.assets)
      || record.outputs.some(output => output.inputFingerprint !== expected.get(output.id)!.inputFingerprint)) {
      return { state: "stale", reason: "현재 프로젝트/자산/정책 입력과 수용 당시 입력이 다릅니다." };
    }
    const missingIds = context.outputs.filter(output => !seen.has(output.id)).map(output => output.id);
    return { state: missingIds.length ? "partial" : "current", record, missingIds };
  } catch { return unverified("프로젝트 수용 기록을 읽지 못했습니다."); }
}

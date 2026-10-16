import type { ProjectSpec } from "@/features/editor/schema";
import { compileProjectTickets } from "@/features/editor/ticket/compileProjectTickets";
import { projectProvenanceContext } from "@/features/editor/export/projectGenerationProvenance";
import fixture from "../fixtures/screen-relations-project.json";
export function runtimeFixture(modalName = 'OtherModal') {
  const project = { ...structuredClone(fixture) as unknown as ProjectSpec, projectId: 'runtime' };
  project.pages.otherModal = structuredClone(project.pages.resetPassword); project.pages.otherModal.name = modalName; project.pageOrder.push('otherModal');
  const plan = compileProjectTickets(project);
  return projectProvenanceContext({ protocol: 1, requestId: 'runtime', projectId: 'runtime', project, plan, assets: [] }, 'owned');
}

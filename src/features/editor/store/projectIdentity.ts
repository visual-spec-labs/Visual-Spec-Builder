import type { ProjectSpec } from "@/features/editor/schema";

/** A saved project's ID survives edits and renames; copy/save-as callers deliberately replace it. */
export function createProjectIdentity(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ensureProjectIdentity(spec: ProjectSpec): ProjectSpec {
  return typeof spec.projectId === "string" && spec.projectId.length > 0
    ? spec
    : { ...spec, projectId: createProjectIdentity() };
}

/** Project identity is metadata, so assigning it must not turn an untouched starter into an edited draft. */
export function withoutProjectIdentity(spec: ProjectSpec): Omit<ProjectSpec, "projectId"> {
  const { projectId: _projectId, ...content } = spec;
  return content;
}

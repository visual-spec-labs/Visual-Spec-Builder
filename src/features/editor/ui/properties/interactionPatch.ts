import type { ButtonNode, NodeId, PageId, ProjectSpec } from "@/features/editor/schema";
import type { Command } from "@/features/editor/command/types";
import { validateScreenRelations } from "@/features/editor/schema/validateScreenRelations";

type Action = NonNullable<ButtonNode["action"]>;
export type InteractionChoice = "none" | Action["type"];

/** No implicit first target: an incomplete target-based choice is UI draft only. */
export function interactionCommand(id: NodeId, choice: InteractionChoice, target = ""): Command | null {
  if (choice === "none") return { type: "removeNodeAction", id };
  if (choice === "close") return { type: "updateNode", id, path: "action", value: { type: "close" } };
  return target === "" ? null : { type: "updateNode", id, path: "action", value: { type: choice, target } };
}

export function interactionTargets(spec: ProjectSpec, choice: InteractionChoice) {
  if (choice !== "navigate" && choice !== "openModal") return [];
  const kind = choice === "navigate" ? "page" : "modal";
  return spec.pageOrder.filter((id) => (spec.pages[id]?.kind ?? "page") === kind && spec.pages[id]).map((id) => ({
    value: id, label: `${spec.pages[id].name} (${id})`,
  }));
}

/** Reuse the relation validator so recovery warnings agree with Save/G3. */
export function interactionWarning(spec: ProjectSpec, pageId: PageId, nodeId: NodeId): string | null {
  const pointer = (value: string) => value.replace(/~/g, "~0").replace(/\//g, "~1");
  const path = `/pages/${pointer(pageId)}/nodes/${pointer(nodeId)}/action`;
  const issues = validateScreenRelations(spec).filter((issue) => issue.path === path || issue.path.startsWith(`${path}/`));
  return issues.length ? issues.map((issue) => issue.message).join("\n") : null;
}

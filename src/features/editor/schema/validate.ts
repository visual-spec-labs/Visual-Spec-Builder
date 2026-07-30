import Ajv2020 from "ajv/dist/2020";

import visualSpecJsonSchema from "./visual-spec.schema.json";
import type { VisualSpec } from "./types";

export type IssueCode =
  | "schema"
  | "root-missing"
  | "root-not-frame"
  | "child-missing"
  | "cycle"
  | "multiple-parents"
  | "orphan-node";

export interface ValidationIssue {
  code: IssueCode;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

type VisualSpecNode = VisualSpec["screen"]["nodes"][string];
type FrameNode = Extract<VisualSpecNode, { type: "frame" }>;

let schemaValidator:
  ReturnType<InstanceType<typeof Ajv2020>["compile"]> | undefined;

function getSchemaValidator(): ReturnType<
  InstanceType<typeof Ajv2020>["compile"]
> {
  if (schemaValidator === undefined) {
    const ajv = new Ajv2020({ allErrors: true });
    schemaValidator = ajv.compile(visualSpecJsonSchema);
  }

  return schemaValidator;
}

function escapeJsonPointer(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function nodePath(nodeId: string): string {
  return `/screen/nodes/${escapeJsonPointer(nodeId)}`;
}

function isFrameNode(node: VisualSpecNode): node is FrameNode {
  return node.type === "frame";
}

function validateReferences(spec: VisualSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { nodes, root } = spec.screen;
  const hasNode = (nodeId: string): boolean =>
    Object.prototype.hasOwnProperty.call(nodes, nodeId);
  const rootNode = hasNode(root) ? nodes[root] : undefined;

  if (rootNode === undefined) {
    issues.push({
      code: "root-missing",
      path: "/screen/root",
      message: `루트 노드 "${root}"가 nodes에 없습니다.`,
    });
  } else if (!isFrameNode(rootNode)) {
    issues.push({
      code: "root-not-frame",
      path: "/screen/root",
      message: `루트 노드 "${root}"의 type은 "frame"이어야 합니다.`,
    });
  }

  const referencedAt = new Map<string, string>();

  for (const [parentId, node] of Object.entries(nodes)) {
    if (!isFrameNode(node)) {
      continue;
    }

    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      const path = `${nodePath(parentId)}/children/${index}/node`;
      const childId = child.node;

      if (!hasNode(childId)) {
        issues.push({
          code: "child-missing",
          path,
          message: `자식 노드 "${childId}"가 nodes에 없습니다.`,
        });
      }

      if (hasNode(childId)) {
        const firstReferencePath = referencedAt.get(childId);
        if (firstReferencePath === undefined) {
          referencedAt.set(childId, path);
        } else if (firstReferencePath !== path) {
          issues.push({
            code: "multiple-parents",
            path,
            message: `노드 "${childId}"가 두 곳 이상에서 참조되었습니다.`,
          });
        }
      }
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  let hasCycle = false;

  const visit = (nodeId: string): void => {
    if (visited.has(nodeId)) {
      return;
    }

    visiting.add(nodeId);
    const node = hasNode(nodeId) ? nodes[nodeId] : undefined;

    if (node !== undefined && isFrameNode(node)) {
      for (let index = 0; index < node.children.length; index += 1) {
        const child = node.children[index];
        const childId = child.node;
        if (!hasNode(childId)) {
          continue;
        }

        if (visiting.has(childId)) {
          hasCycle = true;
          issues.push({
            code: "cycle",
            path: `${nodePath(nodeId)}/children/${index}/node`,
            message: `노드 "${childId}"로 향하는 자식 참조에서 순환이 발견되었습니다.`,
          });
          continue;
        }

        visit(childId);
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const nodeId of Object.keys(nodes)) {
    visit(nodeId);
  }

  // 도달성 계산은 출발점이 성립할 때만 의미가 있다. root가 없으면 모든 노드가
  // 자동으로 도달 불가가 되어 실제 원인 하나가 orphan-node 잡음에 묻힌다.
  const rootMissing = rootNode === undefined;

  if (!hasCycle && !rootMissing) {
    const reachable = new Set<string>();
    const pending = [root];

    while (pending.length > 0) {
      const nodeId = pending.pop();
      if (nodeId === undefined || reachable.has(nodeId)) {
        continue;
      }

      reachable.add(nodeId);
      const node = hasNode(nodeId) ? nodes[nodeId] : undefined;
      if (node !== undefined && isFrameNode(node)) {
        for (const child of node.children) {
          if (hasNode(child.node) && !reachable.has(child.node)) {
            pending.push(child.node);
          }
        }
      }
    }

    for (const nodeId of Object.keys(nodes)) {
      if (!reachable.has(nodeId)) {
        issues.push({
          code: "orphan-node",
          path: nodePath(nodeId),
          message: `노드 "${nodeId}"는 루트에서 도달할 수 없습니다.`,
        });
      }
    }
  }

  return issues;
}

export function validateVisualSpec(input: unknown): ValidationResult {
  try {
    const validateSchema = getSchemaValidator();

    if (!validateSchema(input)) {
      const issues: ValidationIssue[] = (validateSchema.errors ?? []).map(
        (error) => ({
          code: "schema",
          path: error.instancePath || "/",
          message: "JSON 스키마의 구조 규칙을 위반했습니다.",
        }),
      );

      if (issues.length === 0) {
        issues.push({
          code: "schema",
          path: "/",
          message: "스키마 검증에 실패했습니다.",
        });
      }

      return { valid: false, issues };
    }

    const issues = validateReferences(input as VisualSpec);
    return { valid: issues.length === 0, issues };
  } catch {
    return {
      valid: false,
      issues: [
        {
          code: "schema",
          path: "/",
          message: "입력을 검증하는 중 오류가 발생했습니다.",
        },
      ],
    };
  }
}

export function assertVisualSpec(input: unknown): asserts input is VisualSpec {
  const result = validateVisualSpec(input);
  if (!result.valid) {
    throw new VisualSpecValidationError(result.issues);
  }
}

export class VisualSpecValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("Visual Spec 검증에 실패했습니다.");
    this.name = "VisualSpecValidationError";
    this.issues = issues;
  }
}

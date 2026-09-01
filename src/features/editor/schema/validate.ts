import Ajv2020 from "ajv/dist/2020";
import type { ErrorObject } from "ajv/dist/2020";

import visualSpecJsonSchema from "./visual-spec.schema.json";
import type { ProjectSpec, ScreenSpec, VisualSpec } from "./types";

export type IssueCode =
  | "schema"
  | "root-missing"
  | "root-not-frame"
  | "child-missing"
  | "cycle"
  | "multiple-parents"
  | "orphan-node"
  | "page-order-mismatch";

export interface ValidationIssue {
  code: IssueCode;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

type VisualSpecNode = ScreenSpec["nodes"][string];
type FrameNode = Extract<VisualSpecNode, { type: "frame" }>;

type CompiledValidator = ReturnType<InstanceType<typeof Ajv2020>["compile"]>;

let schemaValidator: CompiledValidator | undefined;
let projectSchemaValidator: CompiledValidator | undefined;

function getSchemaValidator(): CompiledValidator {
  if (schemaValidator === undefined) {
    const ajv = new Ajv2020({ allErrors: true });
    schemaValidator = ajv.compile(visualSpecJsonSchema);
  }

  return schemaValidator;
}

/**
 * ProjectSpec은 정본 스키마의 루트가 아니라 `$defs` 항목이다. 루트는 v0.1
 * VisualSpec으로 그대로 두기 위해서다. 그래서 스키마를 통째로 등록한 뒤
 * 해당 `$def`를 가리키는 얇은 스키마를 컴파일한다.
 */
function getProjectSchemaValidator(): CompiledValidator {
  if (projectSchemaValidator === undefined) {
    const ajv = new Ajv2020({ allErrors: true });
    ajv.addSchema(visualSpecJsonSchema, "visual-spec");
    projectSchemaValidator = ajv.compile({
      $ref: "visual-spec#/$defs/ProjectSpec",
    });
  }

  return projectSchemaValidator;
}

function escapeJsonPointer(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function nodePath(basePath: string, nodeId: string): string {
  return `${basePath}/nodes/${escapeJsonPointer(nodeId)}`;
}

function isFrameNode(node: VisualSpecNode): node is FrameNode {
  return node.type === "frame";
}

function describeSchemaError(error: ErrorObject): string {
  const params = error.params as Record<string, unknown>;

  switch (error.keyword) {
    case "required":
      return `필수 필드 "${params.missingProperty}"가 없습니다.`;
    case "additionalProperties":
      return `허용되지 않는 필드 "${params.additionalProperty}"가 있습니다.`;
    case "const":
      return `값이 ${JSON.stringify(params.allowedValue)}이어야 합니다.`;
    case "enum":
      return `값이 ${JSON.stringify(params.allowedValues)} 중 하나여야 합니다.`;
    case "type":
      return `값의 타입이 "${params.type}"이어야 합니다.`;
    case "pattern":
      return `값이 패턴 ${JSON.stringify(params.pattern)}과 일치하지 않습니다.`;
    case "propertyNames":
      return `속성 이름 "${params.propertyName}"이 허용되지 않는 형식입니다.`;
    case "minimum":
    case "exclusiveMinimum":
    case "maximum":
    case "exclusiveMaximum":
      return `값이 허용 범위를 벗어났습니다 (${error.keyword}: ${params.limit}).`;
    case "minLength":
      return `문자열이 너무 짧습니다 (최소 길이: ${params.limit}).`;
    case "minProperties":
      return `속성 개수가 너무 적습니다 (최소: ${params.limit}).`;
    case "multipleOf":
      return `값이 ${params.multipleOf}의 배수여야 합니다.`;
    case "oneOf":
      return "정의된 대안 스키마 중 어느 것과도 일치하지 않습니다. 같은 위치에 있는 다른 이슈가 실제 원인인 경우가 많습니다.";
    default:
      return `JSON 스키마 규칙(${error.keyword})을 위반했습니다.`;
  }
}

function validateScreenReferences(
  screen: ScreenSpec,
  basePath: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { nodes, root } = screen;
  const hasNode = (nodeId: string): boolean =>
    Object.prototype.hasOwnProperty.call(nodes, nodeId);
  const rootNode = hasNode(root) ? nodes[root] : undefined;

  if (rootNode === undefined) {
    issues.push({
      code: "root-missing",
      path: `${basePath}/root`,
      message: `루트 노드 "${root}"가 nodes에 없습니다.`,
    });
  } else if (!isFrameNode(rootNode)) {
    issues.push({
      code: "root-not-frame",
      path: `${basePath}/root`,
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
      const path = `${nodePath(basePath, parentId)}/children/${index}/node`;
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
            path: `${nodePath(basePath, nodeId)}/children/${index}/node`,
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
          path: nodePath(basePath, nodeId),
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
          message: describeSchemaError(error),
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

    const issues = validateScreenReferences(
      (input as VisualSpec).screen,
      "/screen",
    );
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

/**
 * `pageOrder`가 `pages`의 키와 정확히 일치하는지 본다.
 *
 * 이 불변조건은 JSON Schema 2020-12로 표현할 수 없다 — 배열 항목이 객체 키를
 * 참조하는 문법이 없기 때문이다. `nodes` ↔ `children.node`를 그래프 검사로
 * 처리하는 것과 같은 이유로 여기서 따로 확인한다.
 * (`pageOrder` 자체의 중복은 스키마의 `uniqueItems`가 잡는다.)
 */
function validatePageOrder(project: ProjectSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ordered = new Set(project.pageOrder);

  for (let index = 0; index < project.pageOrder.length; index += 1) {
    const pageId = project.pageOrder[index];
    if (!Object.prototype.hasOwnProperty.call(project.pages, pageId)) {
      issues.push({
        code: "page-order-mismatch",
        path: `/pageOrder/${index}`,
        message: `pageOrder의 "${pageId}"가 pages에 없습니다.`,
      });
    }
  }

  for (const pageId of Object.keys(project.pages)) {
    if (!ordered.has(pageId)) {
      issues.push({
        code: "page-order-mismatch",
        path: `/pages/${escapeJsonPointer(pageId)}`,
        message: `페이지 "${pageId}"가 pageOrder에 없습니다.`,
      });
    }
  }

  return issues;
}

/**
 * v0.2 프로젝트 문서를 검증한다. 절대 던지지 않는다.
 * 페이지마다 v0.1과 같은 그래프 검사를 돌리고, 에러 경로는 `/pages/<id>/...`가 된다.
 */
export function validateProjectSpec(input: unknown): ValidationResult {
  try {
    const validateSchema = getProjectSchemaValidator();

    if (!validateSchema(input)) {
      const issues: ValidationIssue[] = (validateSchema.errors ?? []).map(
        (error) => ({
          code: "schema",
          path: error.instancePath || "/",
          message: describeSchemaError(error),
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

    const project = input as ProjectSpec;
    const issues = validatePageOrder(project);

    for (const [pageId, page] of Object.entries(project.pages)) {
      issues.push(
        ...validateScreenReferences(
          page,
          `/pages/${escapeJsonPointer(pageId)}`,
        ),
      );
    }

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

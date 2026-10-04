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
  | "page-order-mismatch"
  | "gradient-stop-order";

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
 * ProjectSpec은 정본 스키마의 루트가 아니라 `$defs` 항목이다. 루트는 단일 화면
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

/**
 * 그라디언트 stop의 `at`이 오름차순인지 본다(같은 값은 허용 — 딱 끊기는 경계).
 *
 * JSON Schema 2020-12에는 배열 원소끼리 비교하는 문법이 없어 여기서 따로 본다.
 * 렌더에서 정렬해 주지 않고 무효로 두는 이유는 CSS가 앞보다 작은 stop을 정렬하지
 * 않고 앞 값으로 끌어올리기 때문이다 — 순서가 틀린 JSON의 뜻이 번역기마다
 * 달라진다(docs/13-background-fill-design.md "표현 규칙").
 *
 * 스키마를 통과한 뒤에만 부르므로 `background`의 모양은 이미 맞다.
 */
function validateGradientStops(
  screen: ScreenSpec,
  basePath: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [nodeId, node] of Object.entries(screen.nodes)) {
    const background = "background" in node ? node.background : undefined;
    if (background === undefined) continue;

    background.forEach((fill, fillIndex) => {
      if (fill.type !== "linear") return;

      for (let index = 1; index < fill.stops.length; index += 1) {
        const previous = fill.stops[index - 1].at;
        const current = fill.stops[index].at;
        if (current < previous) {
          issues.push({
            code: "gradient-stop-order",
            path: `${nodePath(basePath, nodeId)}/background/${fillIndex}/stops/${index}/at`,
            message: `그라디언트 stop의 위치(at)는 오름차순이어야 합니다 — ${current}가 앞 stop의 ${previous}보다 작습니다.`,
          });
        }
      }
    });
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

    const { screen } = input as VisualSpec;
    const issues = [
      ...validateScreenReferences(screen, "/screen"),
      ...validateGradientStops(screen, "/screen"),
    ];
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
 * 프로젝트 문서를 검증한다. 절대 던지지 않는다.
 * 페이지마다 화면 문서와 같은 그래프·stop 정렬 검사를 돌리고, 에러 경로는
 * `/pages/<id>/...`가 된다.
 *
 * 0.1·0.2 문서는 여기서 무효다 — 옛 문서를 받는 입구는 `migrateToV03`로 먼저
 * 바꾼 뒤 검증한다(store/loadSpec.ts·store/specStorage.ts).
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
      const pagePath = `/pages/${escapeJsonPointer(pageId)}`;
      issues.push(
        ...validateScreenReferences(page, pagePath),
        ...validateGradientStops(page, pagePath),
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

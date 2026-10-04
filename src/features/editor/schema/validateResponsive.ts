import Ajv2020 from "ajv/dist/2020";
import visualSpecJsonSchema from "./visual-spec.schema.json";
import type { ScreenSpec } from "./types";
import type { ValidationIssue } from "./validate";

type Validator = ReturnType<InstanceType<typeof Ajv2020>["compile"]>;
const validators = new Map<string, Validator>();
function validator(name: string): Validator {
  let result = validators.get(name);
  if (!result) {
    const ajv = new Ajv2020({ allErrors: true });
    ajv.addSchema(visualSpecJsonSchema, "visual-spec");
    result = ajv.compile({ $ref: `visual-spec#/$defs/${name}` });
    validators.set(name, result);
  }
  return result;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 객체만 재귀 병합한다. 배열·수는 교체하고 입력과 prototype은 변경하지 않는다. */
function merge(base: unknown, patch: unknown): unknown {
  if (!record(patch)) return patch;
  const entries = new Map(Object.entries(record(base) ? base : {}));
  for (const [key, value] of Object.entries(patch)) {
    entries.set(key, merge(entries.get(key), value));
  }
  return Object.fromEntries(entries);
}

function pointer(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** 스키마 통과 뒤 호출한다. GUI에서 렌더하는 함수가 아니라 폭별 계약 검증이다. */
export function validateResponsive(screen: ScreenSpec, basePath: string): ValidationIssue[] {
  const responsive = screen.responsive;
  if (!responsive) return [];
  const issues: ValidationIssue[] = [];
  const path = `${basePath}/responsive`;
  const breakpoints = new Map(Object.entries(responsive.breakpoints));
  const widths = new Set<number>();
  for (const [id, breakpoint] of breakpoints) {
    if (widths.has(breakpoint.minWidthPx)) {
      issues.push({ code: "responsive-duplicate-width", path: `${path}/breakpoints/${pointer(id)}/minWidthPx`, message: "같은 페이지의 breakpoint 폭은 서로 달라야 합니다." });
    }
    widths.add(breakpoint.minWidthPx);
  }
  for (const id of Object.keys(responsive.overrides)) {
    if (!breakpoints.has(id)) issues.push({ code: "responsive-breakpoint-missing", path: `${path}/overrides/${pointer(id)}`, message: `breakpoint "${id}"가 선언되지 않았습니다.` });
  }

  const effective = new Map<string, unknown>(Object.entries(screen.nodes));
  for (const [id] of [...breakpoints].sort((a, b) => a[1].minWidthPx - b[1].minWidthPx)) {
    const overrides = Object.prototype.hasOwnProperty.call(responsive.overrides, id) ? responsive.overrides[id] : {};
    for (const [nodeId, patch] of Object.entries(overrides)) {
      const patchPath = `${path}/overrides/${pointer(id)}/${pointer(nodeId)}`;
      if (!Object.prototype.hasOwnProperty.call(screen.nodes, nodeId)) {
        issues.push({ code: "responsive-node-missing", path: patchPath, message: `노드 "${nodeId}"가 없습니다.` });
        continue;
      }
      const type = screen.nodes[nodeId].type;
      const name = `${type[0].toUpperCase()}${type.slice(1)}`;
      if (!validator(`${name}Override`)(patch)) {
        issues.push({ code: "responsive-node-property", path: patchPath, message: `${type} 노드에서 허용하지 않는 override 속성입니다.` });
        continue;
      }
      const merged = merge(effective.get(nodeId), patch);
      // 무효 결과도 누적한다. 다음 폭이 보완하더라도 이전 폭의 오류는 남는다.
      effective.set(nodeId, merged);
      const validateNode = validator(`${name}Node`);
      if (!validateNode(merged)) {
        for (const error of validateNode.errors ?? []) {
          issues.push({ code: "responsive-effective-node", path: `${patchPath}${error.instancePath}`, message: `상속·병합 후 노드가 무효입니다: ${error.message ?? error.keyword}` });
        }
      }
      if ("background" in patch && patch.background) {
        patch.background.forEach((fill, fillIndex) => {
          if (fill.type !== "linear") return;
          fill.stops.forEach((stop, index) => {
            if (index > 0 && stop.at < fill.stops[index - 1].at) issues.push({ code: "gradient-stop-order", path: `${patchPath}/background/${fillIndex}/stops/${index}/at`, message: "그라디언트 stop의 위치(at)는 오름차순이어야 합니다." });
          });
        });
      }
    }
  }
  return issues;
}

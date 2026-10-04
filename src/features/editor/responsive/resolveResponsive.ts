import type { Node, NodeOverride, Responsive, ScreenSpec } from "@/features/editor/schema";
import { setByPath } from "@/features/editor/store/path";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** 객체만 합성하고 배열·스칼라는 전체 교체한다. 입력을 수정하지 않는다. */
export function mergeResponsiveValue(base: unknown, patch: unknown): unknown {
  if (!record(patch)) return patch;
  const entries = new Map(Object.entries(record(base) ? base : {}));
  for (const [key, value] of Object.entries(patch)) entries.set(key, mergeResponsiveValue(entries.get(key), value));
  return Object.fromEntries(entries);
}
export function sortedBreakpoints(screen: ScreenSpec) {
  return Object.entries(screen.responsive?.breakpoints ?? {}).sort((a, b) => a[1].minWidthPx - b[1].minWidthPx);
}
export function activeBreakpoint(screen: ScreenSpec, width: number): string | null {
  return sortedBreakpoints(screen).filter(([, point]) => point.minWidthPx <= width).at(-1)?.[0] ?? null;
}
/** width는 CSS px. min-width는 경계값을 포함하고 ID가 아닌 숫자 폭 순서로 적용한다. */
export function resolveResponsiveScreen(screen: ScreenSpec, width: number): ScreenSpec {
  if (!screen.responsive) return screen;
  const nodes = new Map(Object.entries(screen.nodes));
  for (const [id, point] of sortedBreakpoints(screen)) {
    if (point.minWidthPx > width) break;
    const patches = Object.prototype.hasOwnProperty.call(screen.responsive.overrides, id) ? screen.responsive.overrides[id] : {};
    for (const [nodeId, patch] of Object.entries(patches)) {
      if (nodes.has(nodeId)) nodes.set(nodeId, mergeResponsiveValue(nodes.get(nodeId), patch) as Node);
    }
  }
  return { ...screen, nodes: Object.fromEntries(nodes) };
}
export function emptyResponsive(): Responsive { return { breakpoints: {}, overrides: {} }; }
/** 기존 컨트롤이 통째로 전달한 객체도 바뀐 leaf만 override한다. */
function changedLeaves(before: unknown, after: unknown): unknown {
  if (!record(before) || !record(after)) return after;
  return Object.fromEntries(Object.entries(after).filter(([key, value]) => value !== undefined && JSON.stringify(before[key]) !== JSON.stringify(value)).map(([key, value]) => [key, changedLeaves(before[key], value)]));
}
export function patchResponsiveNode(screen: ScreenSpec, breakpoint: string, nodeId: string, path: string, value: unknown): Responsive {
  const responsive = screen.responsive ?? emptyResponsive();
  const width = responsive.breakpoints[breakpoint]?.minWidthPx;
  if (width === undefined) return responsive;
  const node = resolveResponsiveScreen(screen, width).nodes[nodeId];
  if (!node) return responsive;
  const nextNode = setByPath(node, path, value);
  const delta = changedLeaves(node, nextNode) as NodeOverride;
  if (Object.keys(delta).length === 0) return responsive;
  const current = Object.prototype.hasOwnProperty.call(responsive.overrides, breakpoint) ? responsive.overrides[breakpoint] : {};
  return { ...responsive, overrides: { ...responsive.overrides, [breakpoint]: { ...current, [nodeId]: mergeResponsiveValue(Object.prototype.hasOwnProperty.call(current, nodeId) ? current[nodeId] : {}, delta) as NodeOverride } } };
}
export function overridePaths(value: unknown, prefix = ""): string[] {
  if (!record(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => overridePaths(child, prefix ? `${prefix}.${key}` : key));
}
export function removeResponsiveOverride(responsive: Responsive, breakpoint: string, nodeId: string, path?: string): Responsive {
  const overrides = structuredClone(responsive.overrides);
  const nodes = Object.prototype.hasOwnProperty.call(overrides, breakpoint) ? overrides[breakpoint] : undefined;
  if (!nodes || !Object.prototype.hasOwnProperty.call(nodes, nodeId)) return responsive;
  if (!path) delete nodes[nodeId];
  else {
    function remove(value: Record<string, unknown>, parts: string[]) {
      const [key, ...rest] = parts;
      if (rest.length === 0) delete value[key];
      else if (Object.prototype.hasOwnProperty.call(value, key) && record(value[key])) {
        remove(value[key], rest);
        if (Object.keys(value[key]).length === 0) delete value[key];
      }
    }
    remove(nodes[nodeId] as Record<string, unknown>, path.split("."));
    if (Object.keys(nodes[nodeId]).length === 0) delete nodes[nodeId];
  }
  if (Object.keys(nodes).length === 0) delete overrides[breakpoint];
  return { ...responsive, overrides };
}

import { collectSubtreeIds } from './applyCommand';
import { generateNodeId, generateNodeIds } from '@/features/editor/store/nodeId';
import { validateProjectSpec, type NodeId, type PageId, type ProjectSpec, type Responsive, type ScreenSpec } from '@/features/editor/schema';

/** GUI-only project command envelope. Screen-local external Transactions remain v0.2. */
export type WidgetProjectCommand =
  | { version: '0.1'; type: 'extractWidget'; pageId: PageId; nodeId: NodeId; widgetId: PageId; name: string }
  | { version: '0.1'; type: 'detachInstance'; pageId: PageId; nodeId: NodeId };

export type WidgetProjectResult = { ok: true; spec: ProjectSpec; selectedId: NodeId } | { ok: false; message: string };
const fail = (message: string): WidgetProjectResult => ({ ok: false, message });
const own = (target: object, key: string) => Object.prototype.hasOwnProperty.call(target, key);

function checked(spec: ProjectSpec, selectedId: NodeId): WidgetProjectResult {
  const result = validateProjectSpec(spec);
  return result.valid ? { ok: true, spec, selectedId } : fail(result.issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
}

function extract(project: ProjectSpec, command: Extract<WidgetProjectCommand, { type: 'extractWidget' }>): WidgetProjectResult {
  const page = own(project.pages, command.pageId) ? project.pages[command.pageId] : undefined;
  if (!page || own(project.pages, command.widgetId) || !command.name.trim() || command.nodeId === page.root) return fail('추출할 프레임이나 새 위젯 ID가 유효하지 않습니다.');
  const source = page.nodes[command.nodeId];
  if (source?.type !== 'frame') return fail('프레임을 선택해 위젯으로 추출하세요.');
  const ids = collectSubtreeIds(page.nodes, command.nodeId);
  const moved = Object.fromEntries([...ids].map(id => [id, structuredClone(page.nodes[id])])) as ScreenSpec['nodes'];
  const widgetRoot = moved[command.nodeId];
  if (widgetRoot.type !== 'frame') return fail('위젯 루트는 프레임이어야 합니다.');
  const normalizedRoot = { ...widgetRoot, box: { width: 'fill' as const, height: source.box.height === 'auto' ? 'auto' as const : 'fill' as const } };
  delete normalizedRoot.visible; // Visibility belongs to the host instance, including responsive overrides.
  moved[command.nodeId] = normalizedRoot;
  const replacement = { type: 'instance' as const, name: command.name, box: structuredClone(source.box), ref: command.widgetId, ...(source.visible === undefined ? {} : { visible: source.visible }) };
  const hostNodes = Object.fromEntries([...Object.entries(page.nodes).filter(([id]) => !ids.has(id)), [command.nodeId, replacement]]) as ScreenSpec['nodes'];

  let hostResponsive = page.responsive ? structuredClone(page.responsive) : undefined;
  let widgetResponsive: Responsive | undefined;
  if (hostResponsive) {
    const widgetOverrides: Responsive['overrides'] = Object.create(null) as Responsive['overrides'];
    for (const [breakpoint, patches] of Object.entries(hostResponsive.overrides)) {
      const movedPatches: typeof patches = Object.create(null) as typeof patches;
      for (const [id, patch] of Object.entries(patches)) {
        if (!ids.has(id)) continue;
        if (id === command.nodeId) {
          const { visible, box, ...rest } = patch;
          if (Object.keys(rest).length) movedPatches[id] = rest;
          const instancePatch = { ...(visible === undefined ? {} : { visible }), ...(box === undefined ? {} : { box }) };
          if (Object.keys(instancePatch).length) patches[id] = instancePatch;
          else delete patches[id];
        } else {
          movedPatches[id] = patch;
          delete patches[id];
        }
      }
      if (Object.keys(movedPatches).length) widgetOverrides[breakpoint] = movedPatches;
      if (!Object.keys(patches).length) delete hostResponsive.overrides[breakpoint];
    }
    if (Object.keys(widgetOverrides).length) widgetResponsive = { breakpoints: structuredClone(page.responsive!.breakpoints), overrides: widgetOverrides };
  }
  const widget: ScreenSpec = {
    kind: 'widget', name: command.name,
    size: { width: typeof source.box.width === 'number' && source.box.width > 0 ? source.box.width : page.size.width,
      height: typeof source.box.height === 'number' && source.box.height > 0 ? source.box.height : page.size.height },
    root: command.nodeId, nodes: moved, ...(widgetResponsive ? { responsive: widgetResponsive } : {}),
  };
  const host: ScreenSpec = { ...page, nodes: hostNodes, ...(hostResponsive ? { responsive: hostResponsive } : {}) };
  return checked({ ...project, pages: { ...project.pages, [command.pageId]: host, [command.widgetId]: widget }, pageOrder: [...project.pageOrder, command.widgetId] }, command.nodeId);
}

function detach(project: ProjectSpec, command: Extract<WidgetProjectCommand, { type: 'detachInstance' }>): WidgetProjectResult {
  const host = own(project.pages, command.pageId) ? project.pages[command.pageId] : undefined;
  const instance = host?.nodes[command.nodeId];
  if (!host || instance?.type !== 'instance') return fail('분리할 위젯 인스턴스를 선택하세요.');
  const source = own(project.pages, instance.ref) ? project.pages[instance.ref] : undefined;
  if (!source || source.kind !== 'widget' || source.nodes[source.root]?.type !== 'frame') return fail('유효한 위젯 원본을 찾을 수 없습니다.');
  const sourceIds = [...collectSubtreeIds(source.nodes, source.root)];
  const allocated = generateNodeIds(sourceIds.map(id => id.replace(/[^A-Za-z0-9_-]/g, '-') || 'widget'), host.nodes);
  const idMap = new Map<string, string>(sourceIds.map((id, index) => [id, allocated[index]]));
  const nodes: ScreenSpec['nodes'] = { ...host.nodes, [command.nodeId]: {
    type: 'frame', name: instance.name, box: structuredClone(instance.box),
    ...(instance.visible === undefined ? {} : { visible: instance.visible }),
    layout: { direction: 'column', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, mainAxis: 'start', crossAxis: 'stretch' },
    children: [{ node: idMap.get(source.root)! }],
  } };
  for (const sourceId of sourceIds) {
    const original = structuredClone(source.nodes[sourceId]);
    const mapped = idMap.get(sourceId)!;
    if (original.type === 'frame') original.children = original.children.map(child => ({ ...child, node: idMap.get(child.node)! }));
    const override = instance.overrides?.[sourceId];
    if (override && (original.type === 'text' || original.type === 'button')) Object.assign(original, override);
    nodes[mapped] = original;
  }

  const responsive: Responsive = host.responsive ? structuredClone(host.responsive) : { breakpoints: {}, overrides: {} };
  if (source.responsive) {
    for (const [sourceBreakpoint, point] of Object.entries(source.responsive.breakpoints)) {
      const existing = Object.entries(responsive.breakpoints).find(([, value]) => value.minWidthPx === point.minWidthPx)?.[0];
      const targetBreakpoint = existing ?? generateNodeId(`widget-${sourceBreakpoint}`, responsive.breakpoints);
      if (!existing) responsive.breakpoints[targetBreakpoint] = structuredClone(point);
      const targetPatches = { ...responsive.overrides[targetBreakpoint] };
      for (const [sourceId, patch] of Object.entries(source.responsive.overrides[sourceBreakpoint] ?? {})) {
        const mapped = idMap.get(sourceId);
        if (!mapped) continue;
        const copy = structuredClone(patch) as Record<string, unknown>;
        if (instance.overrides?.[sourceId]?.color !== undefined) delete copy.color;
        if (!Object.keys(copy).length) continue;
        targetPatches[mapped] = { ...copy, ...targetPatches[mapped] } as typeof patch;
      }
      if (Object.keys(targetPatches).length) responsive.overrides[targetBreakpoint] = targetPatches;
    }
  }
  const page: ScreenSpec = { ...host, nodes, ...(Object.keys(responsive.breakpoints).length ? { responsive } : {}) };
  return checked({ ...project, pages: { ...project.pages, [command.pageId]: page } }, command.nodeId);
}

/** Never mutates the input; all cross-page edits are validated before the caller can commit. */
export function applyWidgetProjectCommand(project: ProjectSpec, command: WidgetProjectCommand): WidgetProjectResult {
  if (command.version !== '0.1') return fail('위젯 프로젝트 명령 버전이 다릅니다.');
  const before = validateProjectSpec(project);
  if (!before.valid) return fail('원본 프로젝트가 유효하지 않습니다.');
  return command.type === 'extractWidget' ? extract(project, command) : detach(project, command);
}

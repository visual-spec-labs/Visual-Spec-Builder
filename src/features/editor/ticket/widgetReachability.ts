import type { ProjectSpec, ScreenSpec } from '@/features/editor/schema';

export function instanceRefs(screen: ScreenSpec): string[] {
  return [...new Set(Object.values(screen.nodes).flatMap(node => node.type === 'instance' ? [node.ref] : []))];
}

/** Only widgets reachable from a generated page/modal participate in code generation. */
export function referencedWidgets(project: ProjectSpec): Set<string> {
  const widgets = new Set<string>();
  const pending = project.pageOrder.filter(id => project.pages[id].kind !== 'widget').flatMap(id => instanceRefs(project.pages[id]));
  while (pending.length) {
    const id = pending.pop()!;
    if (widgets.has(id)) continue;
    const screen = Object.hasOwn(project.pages, id) ? project.pages[id] : undefined;
    if (!screen || screen.kind !== 'widget') continue;
    widgets.add(id);
    pending.push(...instanceRefs(screen));
  }
  return widgets;
}

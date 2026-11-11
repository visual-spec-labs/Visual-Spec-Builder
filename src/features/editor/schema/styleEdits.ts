import type { Color, Node, ProjectSpec, StyleId, StyleRefs, Typography } from "./types";

type StyleableNode = Exclude<Node, { type: "instance" }>;

function isStyleableNode(node: Node): node is StyleableNode {
  return node.type !== "instance";
}

function styleRefsOf(node: Node): StyleRefs | undefined {
  return isStyleableNode(node) ? node.styleRefs : undefined;
}

function withColor(node: Node, target: string, value: Color): Node | undefined {
  if (target === "color" && (node.type === "text" || node.type === "button" || node.type === "input")) return { ...node, color: value };
  if (target === "border.color" && "border" in node && node.border) return { ...node, border: { ...node.border, color: value } };
  if (target === "shadow.color" && node.type === "frame" && node.shadow) return { ...node, shadow: { ...node.shadow, color: value } };
  const match = /^background\.(\d+)\.(?:color|stops\.(\d+)\.color)$/.exec(target);
  if (!match || !("background" in node) || !node.background) return undefined;
  const fills = [...node.background];
  const fillIndex = Number(match[1]);
  const fill = fills[fillIndex];
  if (!fill) return undefined;
  if (match[2] === undefined && fill.type === "solid") fills[fillIndex] = { ...fill, color: value };
  else if (match[2] !== undefined && fill.type === "linear") {
    const stops = [...fill.stops];
    const stopIndex = Number(match[2]);
    if (!stops[stopIndex]) return undefined;
    stops[stopIndex] = { ...stops[stopIndex], color: value };
    fills[fillIndex] = { ...fill, stops: stops as typeof fill.stops };
  } else return undefined;
  return { ...node, background: fills };
}

function withNode(project: ProjectSpec, pageId: string, nodeId: string, update: (node: Node) => Node | undefined): ProjectSpec {
  const page = project.pages[pageId];
  const node = page?.nodes[nodeId];
  if (!page || !node) return project;
  const next = update(node);
  if (!next) return project;
  return { ...project, pages: { ...project.pages, [pageId]: { ...page, nodes: { ...page.nodes, [nodeId]: next } } } };
}

export function linkColorStyle(project: ProjectSpec, pageId: string, nodeId: string, target: string, id: StyleId): ProjectSpec {
  const style = project.styles?.colors?.[id];
  if (!style) return project;
  const current = project.pages[pageId]?.nodes[nodeId];
  if (current && styleRefsOf(current)?.colors?.[target] === id && colorValueAtNode(current, target) === style.value) return project;
  return withNode(project, pageId, nodeId, (node) => {
    const styled = withColor(node, target, style.value);
    if (!styled || !isStyleableNode(styled)) return undefined;
    const colors = { ...(styled.styleRefs?.colors ?? {}), [target]: id };
    return { ...styled, styleRefs: { ...styled.styleRefs, colors } };
  });
}

export function linkTypographyStyle(project: ProjectSpec, pageId: string, nodeId: string, id: StyleId): ProjectSpec {
  const style = project.styles?.typography?.[id];
  if (!style) return project;
  const current = project.pages[pageId]?.nodes[nodeId];
  if (current && isStyleableNode(current) && "typography" in current && current.styleRefs?.typography === id && JSON.stringify(current.typography) === JSON.stringify(style.value)) return project;
  return withNode(project, pageId, nodeId, (node) => {
    if (!isStyleableNode(node) || !("typography" in node)) return undefined;
    return { ...node, typography: structuredClone(style.value), styleRefs: { ...node.styleRefs, typography: id } };
  });
}

export function updateColorStyle(project: ProjectSpec, id: StyleId, name: string, value: Color): ProjectSpec {
  const old = project.styles?.colors?.[id];
  if (!old) return project;
  if (old.name === name && old.value === value) return project;
  let next: ProjectSpec = {
    ...project,
    styles: { ...project.styles, colors: { ...project.styles?.colors, [id]: { name, value } } },
  };
  for (const [pageId, page] of Object.entries(project.pages)) {
    for (const [nodeId, node] of Object.entries(page.nodes)) {
      for (const [target, linkedId] of Object.entries(styleRefsOf(node)?.colors ?? {})) {
        if (linkedId === id) next = withNode(next, pageId, nodeId, (current) => withColor(current, target, value));
      }
    }
  }
  return next;
}

export function updateTypographyStyle(project: ProjectSpec, id: StyleId, name: string, value: Typography): ProjectSpec {
  const old = project.styles?.typography?.[id];
  if (!old) return project;
  if (old.name === name && JSON.stringify(old.value) === JSON.stringify(value)) return project;
  let next: ProjectSpec = {
    ...project,
    styles: { ...project.styles, typography: { ...project.styles?.typography, [id]: { name, value } } },
  };
  for (const [pageId, page] of Object.entries(project.pages)) {
    for (const [nodeId, node] of Object.entries(page.nodes)) {
      if (styleRefsOf(node)?.typography === id) {
        next = withNode(next, pageId, nodeId, (current) => "typography" in current ? { ...current, typography: structuredClone(value) } : undefined);
      }
    }
  }
  return next;
}

function colorValueAtNode(node: Node, target: string): unknown {
  if (target === "color" && "color" in node) return node.color;
  if (target === "border.color" && "border" in node) return node.border?.color;
  if (target === "shadow.color" && node.type === "frame") return node.shadow?.color;
  const match = /^background\.(\d+)\.(?:color|stops\.(\d+)\.color)$/.exec(target);
  if (!match || !("background" in node)) return undefined;
  const fill = node.background?.[Number(match[1])];
  if (!fill) return undefined;
  if (match[2] === undefined) return fill.type === "solid" ? fill.color : undefined;
  return fill.type === "linear" ? fill.stops[Number(match[2])]?.color : undefined;
}

export function unlinkStyle(project: ProjectSpec, kind: "colors" | "typography", id: StyleId): ProjectSpec {
  let next: ProjectSpec = project;
  for (const [pageId, page] of Object.entries(project.pages)) {
    for (const [nodeId, node] of Object.entries(page.nodes)) {
      if (kind === "colors") {
        const nodeRefs = styleRefsOf(node);
        const colors = Object.fromEntries(Object.entries(nodeRefs?.colors ?? {}).filter(([, linkedId]) => linkedId !== id));
        if (Object.keys(colors).length !== Object.keys(nodeRefs?.colors ?? {}).length) {
          next = withNode(next, pageId, nodeId, (current) => {
            if (!isStyleableNode(current)) return undefined;
            const refs = { ...(current.styleRefs ?? {}) };
            if (Object.keys(colors).length) refs.colors = colors;
            else delete refs.colors;
            const { styleRefs: _discard, ...literalNode } = current;
            return Object.keys(refs).length ? { ...literalNode, styleRefs: refs } as Node : literalNode as Node;
          });
        }
      } else if (styleRefsOf(node)?.typography === id) {
        next = withNode(next, pageId, nodeId, (current) => {
          if (!isStyleableNode(current)) return undefined;
          const refs = { ...(current.styleRefs ?? {}) };
          delete refs.typography;
          const { styleRefs: _discard, ...literalNode } = current;
          return Object.keys(refs).length ? { ...literalNode, styleRefs: refs } as Node : literalNode as Node;
        });
      }
    }
  }
  return next;
}

/** Direct edits detach only the color targets they replace; Typography is one linked bundle. */
export function unlinkDirectEditStyle(project: ProjectSpec, pageId: string, nodeId: string, path: string): ProjectSpec {
  const node = project.pages[pageId]?.nodes[nodeId];
  const nodeRefs = node ? styleRefsOf(node) : undefined;
  if (!node || !nodeRefs) return project;
  let colors = { ...(nodeRefs.colors ?? {}) };
  const typography = { ...nodeRefs };
  let changed = false;
  if (path === "typography" || path.startsWith("typography.")) {
    if (typography.typography !== undefined) { delete typography.typography; changed = true; }
  }
  const colorTarget = path === "color" || path === "border.color" || path === "shadow.color"
    ? path
    : /^background\.\d+\.(?:color|stops\.\d+\.color)$/.test(path) ? path : null;
  if (colorTarget && colors[colorTarget] !== undefined) { delete colors[colorTarget]; changed = true; }
  if (path === "background") {
    const retained = Object.fromEntries(Object.entries(colors).filter(([target]) => !target.startsWith("background.")));
    if (Object.keys(retained).length !== Object.keys(colors).length) { colors = retained; changed = true; }
  }
  if (!changed) return project;
  return withNode(project, pageId, nodeId, (current) => {
    if (!isStyleableNode(current)) return undefined;
    const refs = { ...(current.styleRefs ?? {}) };
    if (path === "typography" || path.startsWith("typography.")) delete refs.typography;
    if (path === "background") {
      const retained = Object.fromEntries(Object.entries(refs.colors ?? {}).filter(([target]) => !target.startsWith("background.")));
      if (Object.keys(retained).length) refs.colors = retained;
      else delete refs.colors;
    } else if (colorTarget) {
      const retained = { ...(refs.colors ?? {}) };
      delete retained[colorTarget];
      if (Object.keys(retained).length) refs.colors = retained;
      else delete refs.colors;
    }
    const { styleRefs: _discard, ...literalNode } = current;
    return Object.keys(refs).length ? { ...literalNode, styleRefs: refs } as Node : literalNode as Node;
  });
}

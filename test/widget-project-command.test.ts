import { describe, expect, it } from 'vitest';
import { applyWidgetProjectCommand } from '@/features/editor/command/widgetProjectCommand';
import { validateProjectSpec, type ProjectSpec } from '@/features/editor/schema';
import fixture from './fixtures/screen-relations-project.json';
import { useEditorStore } from '@/features/editor/store/editorStore';
import { resolveResponsiveScreen } from '@/features/editor/responsive/resolveResponsive';

function project() {
  const value = structuredClone(fixture) as unknown as ProjectSpec;
  const page = value.pages.login;
  const root = page.nodes.root;
  if (root.type !== 'frame') throw Error('fixture root');
  page.nodes.card = { ...structuredClone(root), name: 'Card', box: { width: 200, height: 100 }, children: [{ node: 'title' }] };
  root.children = [{ node: 'card' }, ...root.children.filter(child => child.node !== 'title')];
  page.responsive = { breakpoints: { wide: { minWidthPx: 700 } }, overrides: { wide: { card: { box: { width: 240 }, background: [{ type: 'solid', color: '#FFFFFF' }] }, title: { color: '#112233' } } } };
  expect(validateProjectSpec(value).valid).toBe(true);
  return value;
}

describe('project widget commands', () => {
  it('moves base visibility to the host so a responsive instance can reveal the source', () => {
    const before=project();
    before.pages.login.nodes.card.visible=false;
    before.pages.login.responsive!.overrides.wide.card.visible=true;
    const result=applyWidgetProjectCommand(before,{version:'0.1',type:'extractWidget',pageId:'login',nodeId:'card',widgetId:'sharedCard',name:'Shared card'});
    expect(result.ok).toBe(true);
    if(!result.ok)return;
    expect(resolveResponsiveScreen(result.spec.pages.login,800).nodes.card.visible).toBe(true);
    expect(result.spec.pages.sharedCard.nodes.card.visible).not.toBe(false);
  });
  it('extracts a frame atomically, splitting host box/visible from source responsive appearance', () => {
    const before = project();
    const result = applyWidgetProjectCommand(before, { version: '0.1', type: 'extractWidget', pageId: 'login', nodeId: 'card', widgetId: 'sharedCard', name: 'Shared card' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spec.pages.login.nodes.card).toMatchObject({ type: 'instance', ref: 'sharedCard', box: { width: 200, height: 100 } });
    expect(result.spec.pages.login.nodes.title).toBeUndefined();
    expect(result.spec.pages.sharedCard.nodes.title).toHaveProperty('content', '로그인');
    expect(result.spec.pages.login.responsive?.overrides.wide.card).toEqual({ box: { width: 240 } });
    expect(result.spec.pages.sharedCard.responsive?.overrides.wide).toMatchObject({ card: { background: [{ type: 'solid', color: '#FFFFFF' }] }, title: { color: '#112233' } });
    expect(result.spec.pageOrder.at(-1)).toBe('sharedCard');
    expect(validateProjectSpec(result.spec).valid).toBe(true);
    expect(before.pages.login.nodes.card).toHaveProperty('type', 'frame');
  });

  it('detaches a shared widget with ID remapping, overrides and responsive rules; source stays shared', () => {
    const before = project();
    const extraction = applyWidgetProjectCommand(before, { version: '0.1', type: 'extractWidget', pageId: 'login', nodeId: 'card', widgetId: 'sharedCard', name: 'Shared card' });
    if (!extraction.ok) throw Error(extraction.message);
    const shared = extraction.spec;
    const instance = shared.pages.login.nodes.card;
    if (instance.type !== 'instance') throw Error('instance');
    instance.overrides = { title: { content: 'Custom', color: '#445566' } };
    shared.pages.login.nodes.title = structuredClone(shared.pages.sharedCard.nodes.title);
    const root = shared.pages.login.nodes.root;
    if (root.type !== 'frame') throw Error('host root');
    root.children.push({ node: 'title' });
    const result = applyWidgetProjectCommand(shared, { version: '0.1', type: 'detachInstance', pageId: 'login', nodeId: 'card' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const host = result.spec.pages.login;
    const card = host.nodes.card;
    expect(card.type).toBe('frame');
    if (card.type !== 'frame') return;
    const copiedRoot = host.nodes[card.children[0].node];
    expect(copiedRoot.type).toBe('frame');
    if (copiedRoot.type !== 'frame') return;
    const detachedTitle = copiedRoot.children[0].node;
    expect(detachedTitle).not.toBe('title');
    expect(host.nodes[detachedTitle]).toMatchObject({ content: 'Custom', color: '#445566' });
    expect(host.responsive?.overrides.wide.card).toEqual({ box: { width: 240 } });
    expect(host.responsive?.overrides.wide[card.children[0].node]).toMatchObject({ background: [{ type: 'solid', color: '#FFFFFF' }] });
    expect(host.responsive?.overrides.wide[detachedTitle]).toBeUndefined();
    expect(result.spec.pages.sharedCard.nodes.title).toHaveProperty('content', '로그인');
    expect(validateProjectSpec(result.spec).valid).toBe(true);
  });

  it('rejects invalid source, duplicate widget ID and non-frame extraction without changing input', () => {
    const value = project();
    const before = structuredClone(value);
    expect(applyWidgetProjectCommand(value, { version: '0.1', type: 'extractWidget', pageId: 'login', nodeId: 'title', widgetId: 'other', name: 'Other' }).ok).toBe(false);
    expect(applyWidgetProjectCommand(value, { version: '0.1', type: 'extractWidget', pageId: 'login', nodeId: 'card', widgetId: 'dashboard', name: 'Other' }).ok).toBe(false);
    expect(applyWidgetProjectCommand(value, { version: '0.1', type: 'detachInstance', pageId: 'login', nodeId: 'title' }).ok).toBe(false);
    expect(value).toEqual(before);
  });

  it('commits extract and detach as one Undo step each and restores both pages exactly', () => {
    const value = project();
    const store = useEditorStore.getState();
    store.loadSpec(value);
    const initial = useEditorStore.getState();
    store.extractWidget('title');
    expect(useEditorStore.getState().spec).toBe(initial.spec);
    expect(useEditorStore.getState().history).toBe(initial.history);
    store.extractWidget('card');
    const extracted = useEditorStore.getState().spec;
    expect(extracted.pages.login.nodes.card.type).toBe('instance');
    expect(extracted.pageOrder.at(-1)).toBe('widget-1');
    expect(useEditorStore.getState().history.past).toHaveLength(1);
    store.detachInstance('card');
    expect(useEditorStore.getState().spec.pages.login.nodes.card.type).toBe('frame');
    expect(useEditorStore.getState().history.past).toHaveLength(2);
    store.undo();
    expect(useEditorStore.getState().spec).toBe(extracted);
    store.undo();
    expect(useEditorStore.getState().spec).toBe(initial.spec);
  });

  it('keeps source and host breakpoint widths distinct while explicit instance color wins', () => {
    const value = structuredClone(fixture) as unknown as ProjectSpec;
    const host = value.pages.login;
    host.nodes.card = { type: 'instance', name: 'Shared card', box: { width: 200, height: 100 }, ref: 'notificationWidget', overrides: { title: { color: '#445566' } } };
    const root = host.nodes.root;
    if (root.type !== 'frame') throw Error('fixture root');
    root.children.push({ node: 'card' });
    host.responsive = { breakpoints: { hostWide: { minWidthPx: 700 } }, overrides: { hostWide: { card: { box: { width: 240 } } } } };
    value.pages.notificationWidget.responsive = { breakpoints: { sourceWide: { minWidthPx: 500 } }, overrides: { sourceWide: { title: { color: '#112233' }, root: { visible: false } } } };
    expect(validateProjectSpec(value).valid).toBe(true);
    const result = applyWidgetProjectCommand(value, { version: '0.1', type: 'detachInstance', pageId: 'login', nodeId: 'card' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const local = result.spec.pages.login;
    const wrapper = local.nodes.card;
    if (wrapper.type !== 'frame') throw Error('detached wrapper');
    const copiedRootId = wrapper.children[0].node;
    const copiedRoot = local.nodes[copiedRootId];
    if (copiedRoot.type !== 'frame') throw Error('copied root');
    const copiedTitleId = copiedRoot.children[0].node;
    expect(Object.values(local.responsive!.breakpoints).map(point => point.minWidthPx).sort()).toEqual([500, 700]);
    for (const width of [400, 600, 800]) {
      const nodes = resolveResponsiveScreen(local, width).nodes;
      expect(nodes[copiedTitleId]).toHaveProperty('color', '#445566');
      expect(nodes[copiedRootId].visible === false).toBe(width >= 500);
      expect(nodes.card.box.width).toBe(width >= 700 ? 240 : 200);
    }
  });

  it('preserves own __proto__ node and breakpoint IDs during extraction', () => {
    const value = project();
    const page = value.pages.login;
    page.nodes = Object.fromEntries(Object.entries(page.nodes).map(([id, node]) => [id === 'card' ? '__proto__' : id, node]));
    const root = page.nodes.root;
    if (root.type !== 'frame') throw Error('fixture root');
    root.children[0].node = '__proto__';
    page.responsive = { breakpoints: Object.fromEntries([['__proto__', { minWidthPx: 700 }]]),
      overrides: Object.fromEntries([['__proto__', Object.fromEntries([['__proto__', { box: { width: 240 } }]])]]) };
    expect(validateProjectSpec(value).valid).toBe(true);
    const result = applyWidgetProjectCommand(value, { version: '0.1', type: 'extractWidget', pageId: 'login', nodeId: '__proto__', widgetId: 'specialWidget', name: 'Special' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.hasOwn(result.spec.pages.login.nodes, '__proto__')).toBe(true);
    expect(Object.hasOwn(result.spec.pages.login.responsive!.overrides.__proto__, '__proto__')).toBe(true);
    expect(validateProjectSpec(result.spec).valid).toBe(true);
  });
});

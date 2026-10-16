import { describe, expect, it } from 'vitest';
import { createCachedProjectValidator, validateProjectSpec, validateVisualSpec, type ProjectSpec } from '@/features/editor/schema';
import fixture from './fixtures/screen-relations-project.json';
import { preparePageRemoval } from '@/features/editor/store/pageRemoval';
import { useEditorStore } from '@/features/editor/store/editorStore';

function project() {
  const value = structuredClone(fixture) as unknown as ProjectSpec;
  const page = value.pages.login;
  page.nodes.sharedCard = { type: 'instance', name: 'Shared card', box: { width: 100, height: 80 }, ref: 'notificationWidget' };
  const root = page.nodes.root;
  if (root.type !== 'frame') throw Error('fixture root');
  root.children.push({ node: 'sharedCard' });
  return value;
}

function codes(value: ProjectSpec) {
  return validateProjectSpec(value).issues.map(issue => issue.code);
}

describe('IR 0.4 widget instance semantics', () => {
  it('accepts shared widget DAGs and empty Text overrides', () => {
    const value = project();
    const dashboard = value.pages.dashboard;
    dashboard.nodes.sharedCard = { type: 'instance', name: 'Another card', box: { width: 100, height: 80 }, ref: 'notificationWidget', overrides: { title: { content: '' } } };
    const root = dashboard.nodes.root;
    if (root.type !== 'frame') throw Error('fixture root');
    root.children.push({ node: 'sharedCard' });
    expect(codes(value)).toEqual([]);
  });

  it.each([
    ['missing', 'absent', 'instance-ref-missing'],
    ['wrong kind', 'dashboard', 'instance-ref-kind'],
  ])('rejects %s ref', (_label, ref, code) => {
    const value = project();
    const node = value.pages.login.nodes.sharedCard;
    if (node.type !== 'instance') throw Error('fixture instance');
    node.ref = ref;
    expect(codes(value)).toContain(code);
    expect(validateVisualSpec({ version: '0.4', screen: value.pages.login }).valid).toBe(true);
  });

  it('rejects self and indirect widget cycles, separate from navigation cycles', () => {
    const value = project();
    const widget = value.pages.notificationWidget;
    widget.nodes.loop = { type: 'instance', name: 'Loop', box: { width: 10, height: 10 }, ref: 'notificationWidget' };
    const root = widget.nodes.root;
    if (root.type !== 'frame') throw Error('fixture root');
    root.children.push({ node: 'loop' });
    expect(codes(value)).toContain('instance-cycle');
    widget.nodes.loop = { ...widget.nodes.loop, ref: 'otherWidget' } as typeof widget.nodes.loop;
    value.pages.otherWidget = { ...structuredClone(widget), nodes: { ...structuredClone(widget.nodes), loop: { ...widget.nodes.loop, ref: 'notificationWidget' } } };
    expect(codes(value)).toContain('instance-cycle');
  });

  it('rejects missing, nontext and empty Button override targets', () => {
    const value = project();
    const node = value.pages.login.nodes.sharedCard;
    if (node.type !== 'instance') throw Error('fixture instance');
    node.overrides = { absent: { content: 'x' } };
    expect(codes(value)).toContain('instance-override-invalid');
    node.overrides = { root: { color: '#000000' } };
    expect(codes(value)).toContain('instance-override-invalid');
    value.pages.notificationWidget.nodes.button = structuredClone(value.pages.login.nodes.loginButton);
    const widgetRoot = value.pages.notificationWidget.nodes.root;
    if (widgetRoot.type !== 'frame') throw Error('fixture widget root');
    widgetRoot.children.push({ node: 'button' });
    node.overrides = { button: { content: '' } };
    expect(codes(value)).toContain('instance-override-invalid');
    node.overrides = { button: { content: 'Valid' } };
    expect(codes(value)).toEqual([]);
  });

  it('returns schema failures before semantic errors and cached validation matches full', () => {
    const value = project();
    const node = value.pages.login.nodes.sharedCard;
    if (node.type !== 'instance') throw Error('fixture instance');
    node.ref = 'absent';
    const cached = createCachedProjectValidator();
    expect(cached(value)).toEqual(validateProjectSpec(value));
    node.overrides = { title: { content: 'x', color: 'invalid' } };
    expect(codes(value)).toContain('schema');
    expect(codes(value)).not.toContain('instance-ref-missing');
    expect(cached(value)).toEqual(validateProjectSpec(value));
  });

  it('rejects removing a referenced widget and changing an overridden source node', () => {
    const value = project();
    const before = structuredClone(value);
    expect(preparePageRemoval(value, 'notificationWidget')).toMatchObject({ ok: false });
    expect(value).toEqual(before);
    const node = value.pages.login.nodes.sharedCard;
    if (node.type !== 'instance') throw Error('fixture instance');
    node.overrides = { title: { content: 'Customized' } };
    expect(codes(value)).toEqual([]);
    value.pages.notificationWidget.nodes.title = structuredClone(value.pages.notificationWidget.nodes.root);
    expect(codes(value)).toContain('instance-override-invalid');
  });

  it('commits a valid instance with one Undo step and rejects an invalid ref unchanged', () => {
    const value = project();
    const page = value.pages.login;
    delete page.nodes.sharedCard;
    const root = page.nodes.root;
    if (root.type !== 'frame') throw Error('fixture root');
    root.children = root.children.filter(child => child.node !== 'sharedCard');
    const store = useEditorStore.getState();
    store.loadSpec(value);
    const before = useEditorStore.getState();
    store.insertNode('root', 'invalid', { type: 'instance', name: 'Bad', box: { width: 100, height: 80 }, ref: 'absent' });
    expect(useEditorStore.getState().spec).toBe(before.spec);
    expect(useEditorStore.getState().history).toBe(before.history);
    store.insertNode('root', 'valid', { type: 'instance', name: 'Good', box: { width: 100, height: 80 }, ref: 'notificationWidget' });
    expect(useEditorStore.getState().spec.pages.login.nodes.valid).toHaveProperty('ref', 'notificationWidget');
    expect(useEditorStore.getState().history.past).toHaveLength(1);
    store.undo();
    expect(useEditorStore.getState().spec).toBe(before.spec);
  });
});

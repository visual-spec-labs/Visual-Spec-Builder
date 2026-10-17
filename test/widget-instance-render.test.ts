import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import fixture from './fixtures/screen-relations-project.json';
import type { InstanceNode, ProjectSpec } from '@/features/editor/schema';
import { resolvedWidget, WidgetInstance } from '@/features/editor/ui/WidgetInstance';

function setup() {
  const project = structuredClone(fixture) as unknown as ProjectSpec;
  const instance: InstanceNode = { type: 'instance', name: 'Shared notification', box: { width: 200, height: 100 }, ref: 'notificationWidget' };
  return { project, instance };
}

describe('widget instance view', () => {
  it('applies source responsive changes before explicit instance content and color', () => {
    const { project, instance } = setup();
    const widget = project.pages.notificationWidget;
    widget.responsive = { breakpoints: { wide: { minWidthPx: 700 } }, overrides: { wide: { title: { color: '#112233' } } } };
    expect((resolvedWidget(project, instance, 800)?.nodes.title as { content: string; color: string })).toMatchObject({ content: '새 알림', color: '#112233' });
    instance.overrides = { title: { content: 'custom', color: '#445566' } };
    expect((resolvedWidget(project, instance, 800)?.nodes.title as { content: string; color: string })).toMatchObject({ content: 'custom', color: '#445566' });
    expect((resolvedWidget(project, instance, 500)?.nodes.title as { content: string; color: string })).toMatchObject({ content: 'custom', color: '#445566' });
    expect(widget.nodes.title).toHaveProperty('content', '새 알림');
  });

  it('renders repeated widgets with the host box and no copied source DOM IDs', () => {
    const { project, instance } = setup();
    const html = renderToStaticMarkup(createElement('main', null,
      createElement(WidgetInstance, { project, instance, width: 800, direction: 'row', hostNodeId: 'first' }),
      createElement(WidgetInstance, { project, instance, width: 800, direction: 'row', hostNodeId: 'second' }),
    ));
    expect(html).toContain('data-node-id="first"');
    expect(html).toContain('data-node-id="second"');
    expect(html.match(/새 알림/g)).toHaveLength(2);
    expect(html).not.toContain('data-node-id="title"');
    expect(html).not.toContain('min-height:120px');
    expect(html).toContain('width:200px');
  });

  it('fails closed for a missing ref or inclusion cycle', () => {
    const { project, instance } = setup();
    instance.ref = 'missing';
    expect(renderToStaticMarkup(createElement(WidgetInstance, { project, instance, width: 800 }))).toContain('위젯 참조를 표시할 수 없습니다');
    instance.ref = 'notificationWidget';
    const widget = project.pages.notificationWidget;
    widget.nodes.nested = { ...instance, name: 'Nested' };
    const root = widget.nodes.root;
    if (root.type !== 'frame') throw Error('fixture root');
    root.children.push({ node: 'nested' });
    expect(renderToStaticMarkup(createElement(WidgetInstance, { project, instance, width: 800 }))).toContain('위젯 참조를 표시할 수 없습니다');
  });
});

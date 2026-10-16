import { describe, expect, it } from 'vitest';
import { migrateToV04, validateProjectSpec, validateVisualSpec } from '@/features/editor/schema';
import { validateCommand } from '@/features/editor/command/validate';
import { applyCommand } from '@/features/editor/command/applyCommand';
import { compileProjectTickets, ProjectPlanError } from '@/features/editor/ticket/compileProjectTickets';
import { compileTickets } from '@/features/editor/ticket/compileTickets';
import { hasUnsupportedScreenRelations } from '@/features/editor/ticket/screenRelationsGuard';
import { isEditableNodePath } from '@/features/editor/command/editablePath';
import fixture from './fixtures/screen-relations-project.json';
import legacyScreen from './fixtures/legacy/dashboard-cards.v0.1.json';
import legacyProject from './fixtures/legacy/two-page-project.v0.2.json';

function projectWithInstance() {
  const project = structuredClone(fixture) as Record<string, any>;
  const page = project.pages.login;
  const widget = structuredClone(page);
  widget.kind = 'widget';
  project.pages.shared = widget;
  project.pageOrder.push('shared');
  const box = structuredClone(page.nodes.root.box);
  page.nodes.sharedCard = { type: 'instance', name: 'Shared card', box, ref: 'shared', overrides: {} };
  page.nodes.root.children.push({ node: 'sharedCard' });
  return project;
}

describe('IR 0.4 instance schema boundary', () => {
  it('accepts a closed instance and its responsive visible/box override', () => {
    const project = projectWithInstance();
    expect(validateProjectSpec(project).valid).toBe(true);
    project.pages.login.responsive = {
      breakpoints: { narrow: { minWidthPx: 400 } },
      overrides: { narrow: { sharedCard: { visible: false, box: { width: 200 } } } },
    };
    expect(validateProjectSpec(project).valid).toBe(true);
  });

  it.each(['children', 'layout', 'action', 'background'])('rejects forbidden %s on an instance', key => {
    const project = projectWithInstance();
    project.pages.login.nodes.sharedCard[key] = key === 'children' ? [] : {};
    expect(validateProjectSpec(project).valid).toBe(false);
  });

  it('rejects unknown override fields and responsive ref edits', () => {
    const project = projectWithInstance();
    project.pages.login.nodes.sharedCard.overrides.title = { content: 'Title', background: '#FFFFFF' };
    expect(validateProjectSpec(project).valid).toBe(false);
    delete project.pages.login.nodes.sharedCard.overrides.title;
    project.pages.login.responsive = {
      breakpoints: { narrow: { minWidthPx: 400 } },
      overrides: { narrow: { sharedCard: { ref: 'other' } } },
    };
    expect(validateProjectSpec(project).valid).toBe(false);
  });

  it('migrates old envelopes without mutating them or upgrading a hidden instance', () => {
    const current = projectWithInstance();
    const old = { ...current, version: '0.3' };
    const migrated = migrateToV04(old);
    expect(migrated).toBe(old);
    expect(validateProjectSpec(migrated).valid).toBe(false);
    const plain = structuredClone(fixture);
    const previous = { ...plain, version: '0.3' };
    const upgraded = migrateToV04(previous) as Record<string, unknown>;
    expect(upgraded.version).toBe('0.4');
    expect(previous.version).toBe('0.3');
    expect(validateProjectSpec(upgraded).valid).toBe(true);
    expect(migrateToV04(current)).toBe(current);
  });

  it('migrates 0.1/0.2 through the old background conversion and rejects a hidden instance at either old version', () => {
    for (const legacy of [legacyScreen, legacyProject]) {
      const original = structuredClone(legacy) as Record<string, any>;
      const before = JSON.stringify(original);
      const upgraded = migrateToV04(original) as Record<string, unknown>;
      expect(upgraded.version).toBe('0.4');
      expect(JSON.stringify(original)).toBe(before);
      expect(('screen' in upgraded ? validateVisualSpec(upgraded) : validateProjectSpec(upgraded)).valid).toBe(true);
      const poisoned = structuredClone(original);
      const host = 'screen' in poisoned ? poisoned.screen : Object.values(poisoned.pages)[0];
      host.nodes.extra = { type: 'instance', name: 'Hidden', box: { width: 1, height: 1 }, ref: 'x' };
      expect(migrateToV04(poisoned)).toBe(poisoned);
    }
  });

  it('creates an instance through Command v0.2 and validates the project ref', () => {
    const instance = projectWithInstance().pages.login.nodes.sharedCard;
    expect(validateCommand({ type: 'createNode', parentId: 'root', id: 'new', node: instance }).valid).toBe(true);
    const screen = projectWithInstance().pages.login;
    expect(applyCommand(screen as any, { type: 'createNode', parentId: 'root', id: 'new', node: instance })).not.toBe(screen);
  });

  it('blocks project generation while any widget instance is unsupported', () => {
    const project = projectWithInstance();
    project.projectId = 'example';
    expect(() => compileProjectTickets(project as any)).toThrow(ProjectPlanError);
  });

  it('blocks the legacy compiler and allows only displayed instance size edits', () => {
    const project = projectWithInstance();
    const page = project.pages.login;
    expect(hasUnsupportedScreenRelations(page)).toBe(true);
    expect(() => compileTickets(page)).toThrow('Widget instance generation is not supported yet.');
    const instance = page.nodes.sharedCard;
    expect(isEditableNodePath(instance, 'box.width')).toBe(true);
    expect(isEditableNodePath(instance, 'box.height')).toBe(true);
    expect(isEditableNodePath(instance, 'name')).toBe(true);
    expect(isEditableNodePath(instance, 'visible')).toBe(true);
    expect(isEditableNodePath(instance, 'overrides')).toBe(true);
    expect(isEditableNodePath(instance, 'ref')).toBe(false);
  });

  it('rejects old version at current validation while current screen remains valid', () => {
    const project = projectWithInstance();
    expect(validateVisualSpec({ version: '0.4', screen: project.pages.login }).valid).toBe(true);
    expect(validateVisualSpec({ version: '0.3', screen: project.pages.login }).valid).toBe(false);
  });
});

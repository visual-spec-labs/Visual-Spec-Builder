import { describe, expect, it } from 'vitest';
import { posix } from 'node:path';
import { compileProjectTickets } from '@/features/editor/ticket/compileProjectTickets';
import { ticketModulePaths, validateProjectModuleImports } from '@/features/editor/export/projectModuleImports';
import { generatedTicketPath } from '@/features/editor/export/generationIdentity';
import type { FrameNode, ProjectSpec } from '@/features/editor/schema';
import fixture from './fixtures/screen-relations-project.json';

describe('project ticket import scope', () => {
  it('permits same-source modules and declared widget roots, but not other hosts or widget children', async () => {
    const project = { ...structuredClone(fixture), projectId: 'import-scope' } as unknown as ProjectSpec;
    project.pages.login.nodes.shared = { type: 'instance', name: 'Shared', box: { width: 100, height: 80 }, ref: 'notificationWidget' };
    (project.pages.login.nodes.root as FrameNode).children.push({ node: 'shared' });
    project.pages.otherWidget = structuredClone(project.pages.notificationWidget);
    project.pages.otherWidget.name = 'Other widget';
    project.pageOrder.push('otherWidget');
    project.pages.dashboard.nodes.other = { type: 'instance', name: 'Other', box: { width: 100, height: 80 }, ref: 'otherWidget' };
    (project.pages.dashboard.nodes.root as FrameNode).children.push({ node: 'other' });
    const plan = compileProjectTickets(project);
    const widgetRoot = plan.tickets.find(ticket => ticket.widgetRoot)!;
    const host = plan.tickets.find(ticket => ticket.sourcePageId === 'login' && ticket.dependsOn.includes(widgetRoot.id))!;
    const path = (ticket: typeof host) => generatedTicketPath(ticket.sourcePageId, ticket);
    const importFrom = (target: typeof host) => {
      const relative = posix.relative(posix.dirname(path(host)), path(target));
      return `import Item from ${JSON.stringify(relative.startsWith('.') ? relative : './' + relative)};`;
    };
    const allowed = ticketModulePaths(plan, host.id);
    expect(allowed).toContain(path(host));
    expect(allowed).toContain(path(widgetRoot));
    const sibling = plan.tickets.find(ticket => ticket.sourcePageId === 'login' && ticket.id !== host.id)!;
    expect(allowed).toContain(path(sibling));
    expect(allowed).not.toContain(path(plan.tickets.find(ticket => ticket.sourcePageId === 'dashboard')!));
    expect(allowed).not.toContain(path(plan.tickets.find(ticket => ticket.sourcePageId === 'notificationWidget' && !ticket.widgetRoot)!));
    const unrelatedRoot = plan.tickets.find(ticket => ticket.sourcePageId === 'otherWidget' && ticket.widgetRoot)!;
    expect(allowed).not.toContain(path(unrelatedRoot));
    await expect(validateProjectModuleImports(importFrom(widgetRoot), path(host), allowed)).resolves.toBeUndefined();
    await expect(validateProjectModuleImports(importFrom(sibling), path(host), allowed)).resolves.toBeUndefined();
    for (const target of [unrelatedRoot, plan.tickets.find(ticket => ticket.sourcePageId === 'dashboard')!,
      plan.tickets.find(ticket => ticket.sourcePageId === 'notificationWidget' && !ticket.widgetRoot)!]) {
      await expect(validateProjectModuleImports(importFrom(target), path(host), allowed)).rejects.toThrow(/계획/);
    }
    expect(() => ticketModulePaths(plan, 'missing')).toThrow(/계획/);
  });
});

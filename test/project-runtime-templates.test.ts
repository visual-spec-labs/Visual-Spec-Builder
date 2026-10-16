import { describe, expect, it } from "vitest";
import { renderProjectRuntime } from "@/features/editor/export/projectRuntimeTemplates";
import { runtimeFixture } from "./helpers/project-runtime-fixture";
describe('GUI project runtime artifacts', () => {
  it('emits exactly the three owned artifacts with planned roots and excludes widgets', () => {
    const context = runtimeFixture(); const before = structuredClone(context.snapshot);
    const outputs = renderProjectRuntime(context);
    expect([...outputs.keys()]).toEqual(['owned/runtime/Routes.ts', 'owned/runtime/Host.tsx', 'owned/runtime/Entry.tsx']);
    const routes = outputs.get('owned/runtime/Routes.ts')!;
    expect(routes).toContain('export const entryPageId = "login"');
    expect(routes).toContain('new Map<string, ComponentType<ScreenActions>>');
    expect(routes).not.toContain('notificationWidget');
    for (const ticket of context.snapshot.plan.tickets.filter(t => t.kind === 'page')) expect(routes).toContain(`../${ticket.sourcePageId}/pages/${ticket.componentName}`);
    expect(context.snapshot).toEqual(before);
  });
  it('revalidates context rather than trusting a mutable plan', () => {
    const context = runtimeFixture(); context.snapshot.plan.entryPageId = 'missing';
    expect(() => renderProjectRuntime(context)).toThrow();
  });
});

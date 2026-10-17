import { useEditorStore } from "@/features/editor/store/editorStore";
import { useResponsiveScreen } from "@/features/editor/responsive/useResponsiveScreen";
import type { InstanceContentOverride } from "@/features/editor/schema";
import { ColorField, TextField } from "./fields";

/** Direct source text fields only; all edits replace the closed overrides map atomically. */
export function InstanceSection({ id }: { id: string }) {
  const project = useEditorStore(state => state.spec);
  const { breakpoint } = useResponsiveScreen();
  const instance = project.pages[useEditorStore(state => state.activePageId)].nodes[id];
  if (instance?.type !== "instance") return null;
  const source = project.pages[instance.ref];
  if (source?.kind !== "widget") return <p className="p-3 text-xs text-content-muted">참조한 위젯을 찾을 수 없습니다.</p>;
  const targets = Object.entries(source.nodes).filter(([, node]) => node.type === "text" || node.type === "button");

  function write(targetId: string, field: keyof InstanceContentOverride, value: string | undefined, continueEdit = false) {
    const state = useEditorStore.getState();
    const current = state.spec.pages[state.activePageId].nodes[id];
    if (current?.type !== "instance") return;
    const overrides = new Map(Object.entries(current.overrides ?? {}));
    const next = { ...overrides.get(targetId) };
    if (value === undefined) delete next[field];
    else next[field] = value;
    if (Object.keys(next).length) overrides.set(targetId, next);
    else overrides.delete(targetId);
    state.setNodeField(id, "overrides", Object.fromEntries(overrides), continueEdit);
  }

  return <section className="border-t border-line p-3 text-xs text-content">
    <h3 className="mb-2 font-semibold">위젯 내용 재정의 · {source.name}</h3>
    {breakpoint && <p className="mb-2 text-content-muted">내용 재정의는 기본값에서 편집합니다.</p>}
    {targets.map(([targetId, node]) => {
      if (node.type !== "text" && node.type !== "button") return null;
      const override = instance.overrides && Object.hasOwn(instance.overrides, targetId) ? instance.overrides[targetId] : undefined;
      return <fieldset key={targetId} disabled={breakpoint !== null} className="mb-3 space-y-2 border-t border-line pt-2">
        <legend className="font-medium">{node.name}</legend>
        <TextField label={`${node.name} 내용 재정의`} value={override?.content ?? node.content} onChange={(value, continueEdit) => write(targetId, "content", value, continueEdit)} />
        {override?.content !== undefined && <button type="button" className="text-primary" onClick={() => write(targetId, "content", undefined)}>내용 상속</button>}
        <ColorField label={`${node.name} 색 재정의`} value={override?.color ?? node.color} onChange={(value, continueEdit) => write(targetId, "color", value, continueEdit)} />
        {override?.color !== undefined && <button type="button" className="text-primary" onClick={() => write(targetId, "color", undefined)}>색 상속</button>}
      </fieldset>;
    })}
  </section>;
}

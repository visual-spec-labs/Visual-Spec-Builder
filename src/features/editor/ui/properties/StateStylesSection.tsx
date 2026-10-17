import { useEditorStore } from "@/features/editor/store/editorStore";
import type { NodeStates } from "@/features/editor/schema";
import { PropertySection } from "./PropertySection";
import { ColorField } from "./fields";

const STATE_NAMES = [
  ["hover", "Hover"],
  ["pressed", "Pressed"],
  ["focus", "Focus"],
] as const;

export function StateStylesSection() {
  const spec = useEditorStore((state) => state.spec);
  const pageId = useEditorStore((state) => state.activePageId);
  const selectedId = useEditorStore((state) => state.selectedId);
  const setNodeField = useEditorStore((state) => state.setNodeField);
  const node = selectedId ? spec.pages[pageId]?.nodes[selectedId] : undefined;
  if (!selectedId || !node || (node.type !== "button" && node.type !== "input")) return null;
  const controlNode = node;
  const nodeId = selectedId;

  function update(stateName: "hover" | "pressed" | "focus", property: "background" | "color" | "borderColor", value: string | undefined) {
    const next = structuredClone(controlNode.states ?? {}) as NodeStates;
    const entry = { ...(next[stateName] ?? {}) };
    if (value === undefined) delete entry[property];
    else entry[property] = value;
    if (Object.keys(entry).length === 0) delete next[stateName];
    else next[stateName] = entry;
    setNodeField(nodeId, "states", next);
  }

  return (
    <PropertySection title="요소 상태 (States)" defaultOpen={false}>
      {STATE_NAMES.map(([stateName, label]) => (
        <div key={stateName} className="flex flex-col gap-2 rounded-control border border-line p-2">
          <h3 className="text-xs font-semibold text-content">{label}</h3>
          <ColorField label="배경 · 전체 교체" value={controlNode.states?.[stateName]?.background} onChange={(value) => update(stateName, "background", value)} />
          <ColorField label="글자색" value={controlNode.states?.[stateName]?.color} onChange={(value) => update(stateName, "color", value)} />
          <ColorField label="테두리색" value={controlNode.states?.[stateName]?.borderColor} onChange={(value) => update(stateName, "borderColor", value)} />
          <button type="button" className="self-start text-xs text-content-muted underline" onClick={() => {
            const next = structuredClone(controlNode.states ?? {}) as NodeStates;
            delete next[stateName];
            setNodeField(nodeId, "states", next);
          }}>상태 값 모두 지우기</button>
        </div>
      ))}
    </PropertySection>
  );
}

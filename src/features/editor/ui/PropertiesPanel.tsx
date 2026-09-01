import { useEditorStore } from "@/features/editor/store/editorStore";

import { ExportJsonButton } from "./properties/ExportJsonButton";
import { FrameProperties } from "./properties/FrameProperties";
import { PropertySection } from "./properties/PropertySection";
import { TextProperties } from "./properties/TextProperties";
import { useNodeField } from "./properties/useNodeField";
import { ToggleField } from "./properties/fields";

const TYPE_LABEL: Record<string, string> = {
  frame: "Frame",
  text: "Text",
  image: "Image",
};

/** 노드 이름 + 타입 배지 + 표시 토글. 패널 맨 위 공통 영역. */
function NodeHeader({ typeLabel }: { typeLabel: string }) {
  const [name, setName] = useNodeField<string>("name");
  const [visible, setVisible] = useNodeField<boolean>("visible");

  return (
    <header className="flex flex-col gap-2 border-b border-line px-3 py-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label="노드 이름"
          value={name ?? ""}
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1 rounded-control border border-transparent px-1.5 py-1 text-sm font-semibold text-content hover:border-line focus:border-primary focus:outline-none"
        />
        <span className="shrink-0 rounded-control bg-surface-raised px-1.5 py-0.5 text-xs text-content-muted">
          {typeLabel}
        </span>
      </div>
      <ToggleField label="표시" value={visible ?? true} onChange={setVisible} />
    </header>
  );
}

/** 우측 세부설정 패널 — 선택 노드의 속성을 편집한다. */
export function PropertiesPanel() {
  const selectedId = useEditorStore((state) => state.selectedId);
  const node = useEditorStore((state) =>
    selectedId === null ? undefined : state.spec.screen.nodes[selectedId],
  );

  if (selectedId === null || node === undefined) {
    return (
      <aside className="flex flex-col overflow-auto border-l border-line bg-surface [grid-area:props]">
        <h2 className="border-b border-line px-3 py-3 text-xs font-semibold tracking-wide text-content-muted uppercase">
          Properties
        </h2>
        <p className="p-4 text-sm text-content-subtle">
          노드를 선택하면 속성이 여기에 표시됩니다.
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col overflow-hidden border-l border-line bg-surface [grid-area:props]">
      <NodeHeader typeLabel={TYPE_LABEL[node.type] ?? node.type} />

      <div className="flex-1 overflow-auto">
        {node.type === "frame" ? (
          <FrameProperties />
        ) : node.type === "text" ? (
          <TextProperties />
        ) : (
          <PropertySection title="Image">
            <p className="text-sm text-content-subtle">
              이미지 속성 편집은 아직 지원하지 않습니다.
            </p>
          </PropertySection>
        )}
      </div>

      <ExportJsonButton />
    </aside>
  );
}

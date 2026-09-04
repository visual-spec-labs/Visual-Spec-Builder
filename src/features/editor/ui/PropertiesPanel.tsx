import { useEditorStore } from "@/features/editor/store/editorStore";

import { ExportJsonButton } from "./properties/ExportJsonButton";
import { FrameProperties } from "./properties/FrameProperties";
import { PageProperties } from "./properties/PageProperties";
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
  const page = useEditorStore((state) => state.spec.pages[state.activePageId]);
  const node = selectedId === null ? undefined : page.nodes[selectedId];

  // 페이지 행은 곧 그 페이지의 root 프레임이다. root를 골랐을 때 페이지 자체
  // 속성(이름·해상도)을 맨 위에 얹고, 그 아래는 여느 프레임처럼 root 노드를 편집한다.
  // 아무것도 고르지 않았을 때도 같은 섹션을 띄운다 — 빈 안내문만 있는 것보다
  // 화면 크기를 바꿀 자리가 있는 편이 낫고, 캔버스 여백을 누르면 바로 여기로 온다.
  const showPage = node === undefined || selectedId === page.root;

  return (
    <aside className="flex flex-col overflow-hidden border-l border-line bg-surface [grid-area:props]">
      {node === undefined ? (
        <h2 className="border-b border-line px-3 py-3 text-xs font-semibold tracking-wide text-content-muted uppercase">
          Properties
        </h2>
      ) : (
        <NodeHeader typeLabel={TYPE_LABEL[node.type] ?? node.type} />
      )}

      <div className="flex-1 overflow-auto">
        {showPage ? <PageProperties /> : null}

        {node === undefined ? (
          <p className="p-4 text-sm text-content-subtle">
            노드를 선택하면 그 노드의 속성이 여기에 표시됩니다.
          </p>
        ) : node.type === "frame" ? (
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

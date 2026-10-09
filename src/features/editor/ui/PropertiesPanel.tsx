import { PanelRightClose, PanelRightOpen } from "lucide-react";

import { ResponsivePanel } from "@/features/editor/responsive/ResponsivePanel";
import { useResponsiveScreen } from "@/features/editor/responsive/useResponsiveScreen";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { PanelRail } from "@/features/editor/ui/PanelRail";
import { PanelResizeHandle } from "@/features/editor/ui/PanelResizeHandle";
import { usePanelResize } from "@/features/editor/ui/usePanelResize";

import { ExportJsonButton } from "./properties/ExportJsonButton";
import { NodeSectionList } from "./properties/NodeSectionList";
import { PageProperties } from "./properties/PageProperties";
import { useNodeField } from "./properties/useNodeField";
import { ToggleField } from "./properties/fields";

const TYPE_LABEL: Record<string, string> = {
  frame: "프레임",
  text: "텍스트",
  image: "이미지",
  button: "버튼",
  input: "입력",
};

/** 패널 접기 버튼 — 노드 미선택/선택 두 헤더가 같이 쓴다(#287). */
function CollapseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="속성 패널 접기"
      title="속성 패널 접기"
      className="shrink-0 rounded-control p-1 text-content-muted hover:bg-hover hover:text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-content"
    >
      <PanelRightClose className="size-4" aria-hidden="true" />
    </button>
  );
}

/** 노드 이름 + 타입 배지 + 표시 토글. 패널 맨 위 공통 영역. */
function NodeHeader({
  typeLabel,
  onCollapse,
}: {
  typeLabel: string;
  onCollapse: () => void;
}) {
  const { breakpoint } = useResponsiveScreen();
  const [name, setName] = useNodeField<string>("name");
  const [visible, setVisible] = useNodeField<boolean>("visible");

  return (
    <header className="flex flex-col gap-2 border-b border-line px-3 py-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label="노드 이름"
          disabled={breakpoint !== null}
          title={breakpoint ? "노드 이름은 기본값(base)에서 편집합니다." : "선택한 노드의 이름"}
          value={name ?? ""}
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1 rounded-control border border-transparent px-1.5 py-1 text-sm font-semibold text-content hover:border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-content"
        />
        <span className="shrink-0 rounded-control bg-surface-raised px-1.5 py-0.5 text-xs text-content-muted">
          {typeLabel}
        </span>
        <CollapseButton onClick={onCollapse} />
      </div>
      <ToggleField label="표시" value={visible ?? true} onChange={setVisible} />
    </header>
  );
}

/** 우측 세부설정 패널 — 선택 노드의 속성을 편집한다. */
export function PropertiesPanel() {
  const { breakpoint, pageId, width } = useResponsiveScreen();
  const selectedId = useEditorStore((state) => state.selectedId);
  const page = useEditorStore((state) => state.spec.pages[state.activePageId]);
  const node = selectedId === null ? undefined : page.nodes[selectedId];

  // 페이지 행은 곧 그 페이지의 root 프레임이다. root를 골랐을 때 페이지 자체
  // 속성(이름·해상도)을 맨 위에 얹고, 그 아래는 여느 프레임처럼 root 노드를 편집한다.
  // 아무것도 고르지 않았을 때도 같은 섹션을 띄운다 — 빈 안내문만 있는 것보다
  // 화면 크기를 바꿀 자리가 있는 편이 낫고, 캔버스 여백을 누르면 바로 여기로 온다.
  const showPage = node === undefined || selectedId === page.root;

  const {
    collapsed: panelCollapsed,
    width: panelWidth,
    maxWidth: panelMaxWidth,
    setWidth: setPanelWidth,
    toggleCollapsed: togglePanelCollapsed,
    commitPanelLayout,
  } = usePanelResize("props");

  // 접힌 상태는 펼치기 버튼 하나만 있는 좁은 레일이다(#287) — LayerTree.tsx와
  // 같은 패턴(공유 컴포넌트 PanelRail, 자체 code-review 대응으로 중복 제거).
  // docs/22-panel-collapse-resize.md "결정" 1번 참고.
  if (panelCollapsed) {
    return (
      <PanelRail
        gridArea="props"
        border="left"
        icon={PanelRightOpen}
        label="속성 패널 펼치기"
        onExpand={togglePanelCollapsed}
      />
    );
  }

  return (
    <aside aria-label="속성" className="relative flex flex-col overflow-hidden border-l border-line bg-surface [grid-area:props]">
      <PanelResizeHandle
        side="left"
        width={panelWidth}
        maxWidth={panelMaxWidth}
        onResize={setPanelWidth}
        onCommit={commitPanelLayout}
        label="속성 패널 폭 조절"
      />
      {node === undefined ? (
        <div className="flex items-center justify-between border-b border-line px-3 py-3">
          <h2 className="text-xs font-semibold tracking-wide text-content-muted uppercase">
            속성
          </h2>
          <CollapseButton onClick={togglePanelCollapsed} />
        </div>
      ) : (
        <NodeHeader
          key={`${pageId}:${breakpoint}`}
          typeLabel={TYPE_LABEL[node.type] ?? node.type}
          onCollapse={togglePanelCollapsed}
        />
      )}

      <div className="shrink-0 border-b border-line px-3 py-2 text-xs text-content">
        <div role="status" aria-label="현재 편집 범위">
          <p className="break-words">페이지: {page.name}</p>
          <p className="break-words">
            {node === undefined ? "선택: 없음" : `선택: ${node.name || selectedId} · ${selectedId === page.root ? "루트 프레임 1개" : "노드 1개"}`}
          </p>
          <p className="break-words">편집: {breakpoint ? `${breakpoint} 재정의(override)` : "기본값(base)"}</p>
        </div>
        <p className="break-words">미리보기 {width}px</p>
        <p className="mt-1 text-content-muted">
          {node === undefined
            ? breakpoint ? "노드를 선택하면 이 구간의 속성을 편집합니다." : "아래에서 페이지 이름·크기를 편집합니다."
            : showPage && !breakpoint ? "페이지 이름·크기와 루트 프레임 속성을 편집합니다." : "아래 속성은 선택한 노드 하나에 적용됩니다."}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <ResponsivePanel key={pageId} />
        {showPage && !breakpoint ? <PageProperties /> : null}

        {node === undefined || selectedId === null ? (
          <p className="p-4 text-sm text-content-muted">
            노드를 선택하면 그 노드의 속성이 여기에 표시됩니다.
          </p>
        ) : (
          // 타입별 분기는 여기 없다 — properties/nodeSections.ts 의 표가 정한다(#92).
          <NodeSectionList key={`${pageId}:${breakpoint}:${selectedId}`} type={node.type} selectedId={selectedId} />
        )}
      </div>

      <ExportJsonButton />
    </aside>
  );
}

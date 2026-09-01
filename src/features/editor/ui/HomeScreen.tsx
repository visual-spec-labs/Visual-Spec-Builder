import type { Node as SpecNode, NodeId, VisualSpec } from "@/features/editor/schema";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import type { Direction } from "@/features/editor/ui/canvasLayout";
import {
  previewFrameStyle,
  previewImageStyle,
  previewScale,
  previewTextStyle,
} from "@/features/editor/ui/homePreview";

const PREVIEW_WIDTH = 208;
const PREVIEW_HEIGHT = 140;

/**
 * 홈(진입) 화면. docs/04-gui-spec.md §2의 "상태 1(저장된 화면이 있을 때)"만
 * 구현한다.
 *
 * "상태 2(첫 실행 — 목록이 빔, 세 갈래 선택지)"는 이번엔 만들지 않는다.
 * editorStore.spec은 항상 스펙이 정확히 1개고(seedSpec으로 시작, New/Open은
 * 그 자리를 교체할 뿐 목록에 추가하지 않는다), 워크스페이스가 없어(#42) 파일이
 * 여러 개 쌓이거나 0개가 되는 경우 자체가 지금 데이터 모델엔 없다. 목록이
 * "여러 개"이거나 "완전히 빔"을 표현할 방법이 생기면(#42) 그때 상태 2를 만든다.
 */
export function HomeScreen() {
  const spec = useEditorStore((s) => s.spec);
  const loadSpec = useEditorStore((s) => s.loadSpec);
  const openEditor = useNavigationStore((s) => s.openEditor);

  // 지금은 항상 1개다. #42(워크스페이스)가 생기면 이 배열을 실제 목록으로
  // 바꾼다 — 아래 렌더 로직은 이미 배열 기준이라 그대로 쓸 수 있다.
  const screens = [spec];

  function handleNewScreen() {
    loadSpec(blankSpec);
    openEditor();
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-surface-sunken text-content">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="size-4 rounded-sm bg-primary" />
          <span className="font-semibold text-content-strong">
            Visual Spec Builder
          </span>
        </div>
        <button
          type="button"
          onClick={handleNewScreen}
          className="rounded-control bg-primary px-3 py-1.5 text-sm font-medium text-text-on-accent hover:opacity-90"
        >
          + 새 화면
        </button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <p className="mb-4 text-sm text-content-subtle">화면 {screens.length}개</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(208px,1fr))] gap-4">
          {screens.map((screenSpec) => (
            <ScreenCard
              key={screenSpec.screen.name}
              spec={screenSpec}
              onOpen={openEditor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenCard({
  spec,
  onOpen,
}: {
  spec: VisualSpec;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-2 rounded-panel border border-line bg-surface p-2 text-left hover:border-primary"
    >
      <ScreenPreview spec={spec} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-content-strong">
          {spec.screen.name}
        </p>
        <p className="text-xs text-content-subtle">
          {spec.screen.size.width}×{spec.screen.size.height}
        </p>
      </div>
    </button>
  );
}

/** 캡처 이미지를 저장하지 않는다 — 스펙 JSON에서 매번 즉석 렌더한다(해결된 항목, docs/open-questions.md). */
function ScreenPreview({ spec }: { spec: VisualSpec }) {
  const { width, height } = spec.screen.size;
  const scale = previewScale(width, height, PREVIEW_WIDTH, PREVIEW_HEIGHT);

  return (
    <div
      className="relative overflow-hidden rounded-control bg-surface-canvas"
      style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
    >
      <div
        className="absolute top-0 left-0"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        <PreviewNode id={spec.screen.root} nodes={spec.screen.nodes} />
      </div>
    </div>
  );
}

function PreviewNode({
  id,
  nodes,
  parentDirection,
}: {
  id: NodeId;
  nodes: Record<NodeId, SpecNode>;
  parentDirection?: Direction;
}) {
  const node = nodes[id];
  if (node === undefined || node.visible === false) {
    return null;
  }

  if (node.type === "frame") {
    return (
      <div style={previewFrameStyle(node, parentDirection)}>
        {node.children.map((child) => (
          <PreviewNode
            key={child.node}
            id={child.node}
            nodes={nodes}
            parentDirection={node.layout.direction}
          />
        ))}
      </div>
    );
  }

  if (node.type === "text") {
    return <div style={previewTextStyle(node, parentDirection)}>{node.content}</div>;
  }

  return <div style={previewImageStyle(node, parentDirection)} />;
}

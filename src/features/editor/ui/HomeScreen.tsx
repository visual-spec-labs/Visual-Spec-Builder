import type {
  Node as SpecNode,
  NodeId,
  ProjectSpec,
  ScreenSpec,
} from "@/features/editor/schema";
import { blankSpec } from "@/features/editor/store/blankSpec";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import type { Direction } from "@/features/editor/ui/canvasLayout";
import {
  previewButtonStyle,
  previewFrameStyle,
  previewImageStyle,
  previewInputStyle,
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
 * editorStore.spec은 항상 프로젝트가 정확히 1개고(seedSpec으로 시작, New/Open은
 * 그 자리를 교체할 뿐 목록에 추가하지 않는다), 워크스페이스가 없어(#42) 파일이
 * 여러 개 쌓이거나 0개가 되는 경우 자체가 지금 데이터 모델엔 없다. 목록이
 * "여러 개"이거나 "완전히 빔"을 표현할 방법이 생기면(#42) 그때 상태 2를 만든다.
 *
 * **카드 하나 = 프로젝트 하나(화면 아님).** 스키마 v0.2(#60/#61)에서 저장 단위가
 * "화면 1개"(VisualSpec)에서 "프로젝트 1개, 페이지 여러 장"(ProjectSpec)으로
 * 바뀌었다 — docs/04-gui-spec.md §2 참고. 페이지 전환은 홈으로 나가지 않고
 * 에디터 안 레이어 트리에서 한다(#63). 이 목록도 그래서 페이지가 아니라
 * 프로젝트를 나열한다.
 */
export function HomeScreen() {
  const spec = useEditorStore((s) => s.spec);
  const loadSpec = useEditorStore((s) => s.loadSpec);
  const openEditor = useNavigationStore((s) => s.openEditor);

  // 지금은 항상 1개다. #42(워크스페이스)가 생기면 이 배열을 실제 목록으로
  // 바꾼다 — 아래 렌더 로직은 이미 배열 기준이라 그대로 쓸 수 있다.
  const projects = [spec];

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
        <p className="mb-4 text-sm text-content-subtle">
          프로젝트 {projects.length}개
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(208px,1fr))] gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.name} spec={project} onOpen={openEditor} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  spec,
  onOpen,
}: {
  spec: ProjectSpec;
  onOpen: () => void;
}) {
  // 열면 editorStore.loadSpec이 항상 pageOrder[0]을 활성 페이지로 잡는다
  // (editorStore.ts) — 그래서 카드 미리보기·크기도 같은 페이지를 기준으로
  // 삼는다. 클릭해서 열었을 때 보게 될 화면과 카드가 어긋나지 않는다.
  const coverPage = spec.pages[spec.pageOrder[0]];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-2 rounded-panel border border-line bg-surface p-2 text-left hover:border-primary"
    >
      <ProjectPreview page={coverPage} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-content-strong">
          {spec.name}
        </p>
        <p className="text-xs text-content-subtle">
          페이지 {spec.pageOrder.length}개 · {coverPage.size.width}×
          {coverPage.size.height}
        </p>
      </div>
    </button>
  );
}

/** 캡처 이미지를 저장하지 않는다 — 스펙 JSON에서 매번 즉석 렌더한다(해결된 항목, docs/open-questions.md). */
function ProjectPreview({ page }: { page: ScreenSpec }) {
  const { width, height } = page.size;
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
        <PreviewNode id={page.root} nodes={page.nodes} />
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

  if (node.type === "button") {
    return <div style={previewButtonStyle(node, parentDirection)}>{node.content}</div>;
  }

  if (node.type === "input") {
    return <div style={previewInputStyle(node, parentDirection)}>{node.placeholder}</div>;
  }

  return <div style={previewImageStyle(node, parentDirection)} />;
}

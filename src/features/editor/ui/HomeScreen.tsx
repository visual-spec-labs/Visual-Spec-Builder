import { useEffect, useState } from "react";

import type {
  Node as SpecNode,
  NodeId,
  ProjectSpec,
  ScreenSpec,
} from "@/features/editor/schema";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import type { Direction } from "@/features/editor/ui/canvasLayout";
import { newSpec } from "@/features/editor/ui/newSpec";
import { openSpec } from "@/features/editor/ui/openSpecFromFile";
import {
  previewButtonStyle,
  previewFrameStyle,
  previewImageStyle,
  previewInputStyle,
  previewScale,
  previewTextStyle,
} from "@/features/editor/ui/homePreview";
import { loadWorkspaceProjects, type HomeProject } from "./homeProjects";

const PREVIEW_WIDTH = 208;
const PREVIEW_HEIGHT = 140;

/**
 * 홈(진입) 화면. docs/04-gui-spec.md §2의 상태 1(목록)·상태 2(첫 실행, 빈 목록,
 * 세 갈래 선택지)를 `.visual-spec/specs/`의 실제 파일 목록에 따라 가른다(이슈 #186).
 *
 * **예전엔 상태 1만, 그것도 카드 한 장 고정이었다.** "워크스페이스가 없어(#42)
 * 프로젝트가 항상 정확히 1개"라는 근거가 달려 있었는데, #133(워크스페이스
 * Open/Save)이 머지되며 사실이 아니게 됐다 — `specs/`에 파일이 여러 개 쌓일 수
 * 있고 `ui/openSpecFromFile.ts`의 `openSpec()`이 이미 그 목록을 읽고 있었다.
 * 안 된 건 이 컴포넌트가 메모리상 `editorStore.spec` 대신 그 목록을 읽어오는
 * 배선뿐이었다.
 *
 * 마운트 시 `listWorkspaceFileEntries(SPEC_DIR)`로 목록을, 파일마다
 * `readWorkspaceTextFile`+`parseSpecJson`(+화면 문서면 `migrateV01`)로 내용을 읽는다.
 * **작업공간이 없으면**(`listWorkspaceFileEntries`가 `null`, 정적 빌드 등) 조용히
 * 예전처럼 메모리 spec 한 장짜리 상태 1로 되돌아간다. **파싱에 실패한 파일은
 * 목록에서 조용히 뺀다** — 깨진 파일 하나 때문에 카드 전체가 안 뜨는 것보다 낫다.
 * 결과가 0개면 상태 2, 1개 이상이면 상태 1 — 같은 조건 하나로 갈린다.
 *
 * **"자연어로 초안 만들기"는 지금 "빈 캔버스에서 시작"과 똑같이 동작한다** — 실제
 * 자연어 작성은 에디터 안 `ui/NaturalLanguageBar.tsx`에서만 되고, 홈 화면에 별도
 * 입력창을 새로 만드는 건 이 이슈(파일 목록 배선) 범위 밖이다.
 *
 * 목록의 opt-in mtime 메타데이터로 최근 수정순 정렬한다(#227 일부).
 * 동률은 파일명순이다. 카드 액션·이름 정책은 여전히 별도 결정 사항이다.
 *
 * **카드 하나 = 프로젝트 하나(화면 아님).** 스키마 v0.2(#60/#61)에서 저장 단위가
 * "화면 1개"(VisualSpec)에서 "프로젝트 1개, 페이지 여러 장"(ProjectSpec)으로
 * 바뀌었다 — docs/04-gui-spec.md §2 참고. 페이지 전환은 홈으로 나가지 않고
 * 에디터 안 레이어 트리에서 한다(#63). 이 목록도 그래서 페이지가 아니라
 * 프로젝트를 나열한다.
 */

type HomeState =
  | { kind: "loading" }
  | { kind: "no-workspace" }
  | { kind: "ready"; projects: HomeProject[] };

export function HomeScreen() {
  const spec = useEditorStore((s) => s.spec);
  const openEditor = useNavigationStore((s) => s.openEditor);
  const [state, setState] = useState<HomeState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void loadWorkspaceProjects().then((projects) => {
      if (cancelled) return;
      setState(projects === null ? { kind: "no-workspace" } : { kind: "ready", projects });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // "+ 새 화면"도 File ▸ New와 같은 동작이다 — 빈 스펙을 열고 **현재 문서 이름을
  // 비운다**(PR #145 리뷰). 비우지 않으면 새로 만든 화면의 Save가 직전에 열어 둔
  // 파일을 덮어쓴다. 둘이 같은 동작이라 정의는 ui/newSpec.ts 한 곳에 있다.
  function handleNewScreen() {
    newSpec();
    openEditor();
  }

  // 카드는 목록을 만들 때 이미 내용을 읽어 뒀다 — 다시 읽지 않고 그 spec을 그대로
  // loadSpec에 넘긴다. setFileName으로 "지금 연 파일"을 기억시켜야 그 뒤의
  // File ▸ Save가 이 파일에 그대로 쓴다(documentStore.ts, 이슈 #185).
  function handleOpenProject(project: HomeProject) {
    useEditorStore.getState().loadSpec(project.spec);
    useDocumentStore.getState().setFileName(project.fileName, project.diskRevision);
    openEditor();
  }

  // 상태 2의 "기존 화면 불러오기" — File ▸ Open과 같은 openSpec()을 그대로 쓴다.
  // openSpec()은 성공 여부를 돌려주지 않으므로(prompt 취소·검증 실패 시 아무
  // 일도 안 하고 조용히 끝난다) spec 참조가 바뀌었는지로 판정한다 — 바뀌었어야만
  // 에디터로 넘어간다. 취소하면 홈에 그대로 남는다.
  async function handleOpenExisting() {
    const before = useEditorStore.getState().spec;
    await openSpec();
    if (useEditorStore.getState().spec !== before) openEditor();
  }

  if (state.kind === "loading") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-sunken text-sm text-content-subtle">
        불러오는 중…
      </div>
    );
  }

  // 작업공간이 없으면(정적 빌드) 예전과 똑같이 메모리 spec 한 장을 상태 1로 보여준다.
  // 파일이 아니니 클릭해도 openEditor()만 한다 — 이미 그 spec이 에디터에도 떠 있다.
  const cards =
    state.kind === "no-workspace"
      ? [{ key: spec.name, spec, onOpen: openEditor }]
      : state.projects.map((project) => ({
          key: project.fileName,
          spec: project.spec,
          onOpen: () => handleOpenProject(project),
        }));

  if (cards.length === 0) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-surface-sunken px-6 text-content">
        <div className="text-center">
          <p className="text-lg font-semibold text-content-strong">첫 화면을 만들어 봅시다</p>
          <p className="mt-1 text-sm text-content-subtle">어떻게 시작하시겠습니까?</p>
        </div>
        <div className="flex w-full max-w-sm flex-col divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
          <button
            type="button"
            onClick={handleNewScreen}
            className="flex flex-col gap-0.5 px-4 py-3 text-left hover:bg-hover"
          >
            <span className="text-sm font-medium text-content-strong">자연어로 초안 만들기</span>
            <span className="text-xs text-content-subtle">설명을 입력하면 구조를 생성합니다</span>
          </button>
          <button
            type="button"
            onClick={handleNewScreen}
            className="flex flex-col gap-0.5 px-4 py-3 text-left hover:bg-hover"
          >
            <span className="text-sm font-medium text-content-strong">빈 캔버스에서 시작</span>
            <span className="text-xs text-content-subtle">직접 요소를 배치합니다</span>
          </button>
          <button
            type="button"
            onClick={() => void handleOpenExisting()}
            className="flex flex-col gap-0.5 px-4 py-3 text-left hover:bg-hover"
          >
            <span className="text-sm font-medium text-content-strong">기존 화면 불러오기</span>
            <span className="text-xs text-content-subtle">JSON 파일을 엽니다</span>
          </button>
        </div>
      </div>
    );
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
          프로젝트 {cards.length}개
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(208px,1fr))] gap-4">
          {cards.map((card) => (
            <ProjectCard key={card.key} spec={card.spec} onOpen={card.onOpen} />
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

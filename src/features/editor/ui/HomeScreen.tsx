import { type RefObject, useEffect, useRef, useState } from "react";

import type {
  Node as SpecNode,
  NodeId,
  ProjectSpec,
  ScreenSpec,
} from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { setHomeDraft } from "@/features/editor/store/homeDraft";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { promptText } from "@/features/editor/store/promptDialogStore";
import type { Direction } from "@/features/editor/ui/canvasLayout";
import { downloadTextFile } from "@/features/editor/ui/exportSpecAsJson";
import { HOME_DRAFT_EXAMPLES } from "@/features/editor/ui/homeDraftExamples";
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
import { renameProject } from "./renameProject";
import {
  loadWorkspaceProjects,
  loadWorkspaceProjectsProgressively,
  openHomeProject,
  type HomeProject,
  type HomeProjectFailure,
} from "./homeProjects";

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
 * 예전처럼 메모리 spec 한 장짜리 상태 1로 되돌아간다. **읽기·검증에 실패한
 * 파일은 카드가 되지 못하지만 조용히 사라지지 않는다**(#288) — 사유(읽기 실패/
 * 검증 실패)와 함께 "손상된 파일" 섹션에 남고, 다시 확인·원본 다운로드 진입점을
 * 준다(`homeProjects.ts`의 `HomeProjectFailure`). 카드 수가 0개면 상태 2,
 * 1개 이상이면 상태 1 — 손상 파일 유무와 무관하게 **유효한** 카드 수로만 갈린다.
 *
 * **"자연어로 초안 만들기"는 홈 화면 안에서 먼저 작성한다**(#286). 상태 2(빈
 * 목록)에서 그 타일을 고르면 입력창·초안 예시·수동 에이전트 안내를 보여주는
 * 인라인 패널(`draftMode`)로 바뀐다. "초안 만들기"를 누르면 빈 프로젝트를 열고
 * 그 문구를 `store/homeDraft.ts`에 적재한다 — 새로 마운트되는
 * `ui/NaturalLanguageBar.tsx`가 그 문구를 한 번 읽어 입력칸에 채우고 포커스한다.
 * **전송("요청")은 보내지 않는다** — 에이전트가 아직 안 켜져 있으면 3분 뒤
 * timeout으로 끝나므로, #283이 확립한 "수동 전달" 원칙과 같은 이유로 사용자가
 * 직접 누르게 둔다(`docs/21-home-screen-nl-draft.md` "결정" 참고).
 *
 * 목록의 opt-in mtime 메타데이터로 최근 수정순 정렬한다(#227 일부).
 * 동률은 파일명순이다. 이름 변경은 표시 이름과 실제 파일명을 함께 바꾸고 동명 파일은 보존한다.
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
  /** `loading`이면 앞쪽 카드만 읽었고 뒤를 마저 읽는 중이다(#316). `failures`는
   * 읽기/검증에 실패한 파일(#288) — 지금까지 읽은 묶음 기준이라 `loading`일 때도
   * 계속 늘어날 수 있다. */
  | { kind: "ready"; projects: HomeProject[]; failures: HomeProjectFailure[]; loading: boolean };

export function HomeScreen() {
  const spec = useEditorStore((s) => s.spec);
  const openEditor = useNavigationStore((s) => s.openEditor);
  const [renaming, setRenaming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<HomeState>({ kind: "loading" });
  // 상태 2(빈 목록)의 "자연어로 초안 만들기" 인라인 패널(#286). 다른 상태(목록이
  // 있거나 로딩 중)에서는 쓰이지 않는다.
  const [draftMode, setDraftMode] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [submittingDraft, setSubmittingDraft] = useState(false);
  const draftInputRef = useRef<HTMLInputElement>(null);
  // 카드 목록을 스크롤하는 요소 — 미리보기를 미리 그릴 범위(rootMargin)의 기준이다(#315).
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  // 미리보기를 이미 그린 카드(key). 이름 변경으로 key(파일 이름)가 바뀌어 카드가 다시 마운트돼도
  // 빈 자리로 깜빡이지 않게 새 key로 넘긴다.
  const drawnPreviews = useRef(new Set<string>());
  // 목록 읽기 세대. 이름 변경으로 목록을 새로 읽으면 올려서, 아직 뒤를 읽던 처음 읽기가 새 목록을
  // 덮지 못하게 한다(#316).
  const loadGeneration = useRef(0);
  // 처음 읽기의 남은 요청을 멈춘다(이름 변경으로 목록을 다시 읽을 때).
  const abortLoad = useRef<() => void>(() => undefined);

  useEffect(() => {
    let cancelled = false;
    const generation = loadGeneration.current;
    const stale = () => cancelled || generation !== loadGeneration.current;
    const reads = new AbortController();
    abortLoad.current = () => reads.abort();
    // 앞에서부터 묶음으로 읽어 첫 화면 카드를 먼저 그린다(#316). 뒤 묶음은 이어 붙기만 한다.
    // 못 읽거나 검증에 실패한 파일도 묶음마다 failures에 쌓인다(#288).
    void loadWorkspaceProjectsProgressively(
      (projects, failures, done) => setState({ kind: "ready", projects, failures, loading: !done }),
      { isCancelled: stale, signal: reads.signal },
    ).then((exists) => {
      if (!stale() && !exists) setState({ kind: "no-workspace" });
    });
    return () => {
      cancelled = true;
      reads.abort();
    };
  }, []);

  // 손상 파일 섹션의 "다시 확인"과 Rename 이후 둘 다 같은 새로고침이 필요하다(#288).
  // 아직 뒤를 읽는 처음 읽기가 남아 있으면 먼저 멈춘다 — 안 그러면 그 진행 중인
  // onProgress가 나중에 끝나며 이 새로고침 결과를 덮어쓸 수 있다.
  async function refreshProjects() {
    loadGeneration.current += 1;
    abortLoad.current();
    const result = await loadWorkspaceProjects();
    if (result !== null) setState({ kind: "ready", ...result, loading: false });
    // 다시 읽기에 실패해도(작업공간 연결 끊김 등) 처음 읽기는 이미 멈췄다 — 보이던 목록을 두고
    // "불러오는 중"만 끈다. 그대로 두면 표시가 영영 남는다.
    else setState((current) => (current.kind === "ready" ? { ...current, loading: false } : current));
  }

  // "+ 새 화면"도 File ▸ New와 같은 동작이다 — 빈 스펙을 열고 **현재 문서 이름을
  // 비운다**(PR #145 리뷰). 비우지 않으면 새로 만든 화면의 Save가 직전에 열어 둔
  // 파일을 덮어쓴다. 둘이 같은 동작이라 정의는 ui/newSpec.ts 한 곳에 있다.
  async function handleNewScreen() {
    if (await newSpec()) openEditor();
  }

  // 상태 2-nl의 "초안 만들기"(#286). 빈 프로젝트를 여는 동작은 handleNewScreen과
  // 같지만, 작성한 문구를 store/homeDraft.ts에 적재해 새로 마운트될
  // NaturalLanguageBar가 입력칸에 채워 넣게 한다. 요청을 대신 보내지는 않는다
  // (docs/21-home-screen-nl-draft.md "결정" 참고).
  //
  // handleRename의 renaming 가드와 같은 이유로 submittingDraft를 둔다(자체
  // code-review 대응) — Enter와 클릭이 겹치거나 Enter를 빠르게 두 번 누르면
  // newSpec()의 await 구간(settle()이 포함된다) 동안 handleCreateDraft가 다시
  // 들어와 newSpec()+setHomeDraft()+openEditor()가 겹쳐 실행될 수 있다.
  //
  // 같은 플래그로 아래 입력창·예시 칩·뒤로 버튼도 모두 잠근다(PR #312 리뷰
  // 대응) — 실제 autosave Web Lock 경합으로 newSpec()의 settle()이 지연되는
  // 동안 입력창이 열려 있으면, text를 캡처한 뒤에도 화면에서는 새 글자를
  // 계속 칠 수 있다. 그 상태로 await가 끝나면 에디터에는 캡처해 둔 옛 값이
  // 전달되는데 화면엔 사용자가 방금 친 새 값이 보이고 있었다 — 보이는 값과
  // 실제로 전달되는 값이 조용히 갈라지는 결함이었다.
  async function handleCreateDraft() {
    if (submittingDraft) return;
    const text = draftText.trim();
    if (text === "") return;
    setSubmittingDraft(true);
    if (await newSpec()) {
      setHomeDraft(text);
      openEditor();
      return;
    }
    setSubmittingDraft(false);
  }

  async function handleOpenProject(project: HomeProject) {
    if (await openHomeProject(project)) openEditor();
  }

  async function handleRename(project: HomeProject) {
    if (renaming) return;
    const name = await promptText({
      title: "프로젝트 이름 변경",
      message: "저장 파일명도 함께 변경됩니다.",
      initialValue: project.spec.name,
      confirmLabel: "이름 변경",
    });
    if (name === null) return;
    setRenaming(true);
    setMessage(null);
    loadGeneration.current += 1; // 아직 뒤를 읽는 처음 읽기를 멈춘다
    abortLoad.current();
    const result = await renameProject(project.fileName, name);
    if (!result.ok) setMessage(result.error);
    else if (drawnPreviews.current.has(project.fileName)) drawnPreviews.current.add(result.path.split("/").pop() ?? "");
    await refreshProjects();
    setRenaming(false);
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

  // 뒤를 마저 읽는 중인데 아직 보여 줄 카드가 없으면(앞 묶음이 모두 깨진 파일) 빈 목록(상태 2)이
  // 아니라 불러오는 중이다.
  if (state.kind === "loading" || (state.kind === "ready" && state.loading && state.projects.length === 0)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-sunken text-sm text-content-muted">
        불러오는 중…
      </div>
    );
  }

  // 작업공간이 없으면(정적 빌드) 예전과 똑같이 메모리 spec 한 장을 상태 1로 보여준다.
  // 파일이 아니니 클릭해도 openEditor()만 한다 — 이미 그 spec이 에디터에도 떠 있다.
  const cards =
    state.kind === "no-workspace"
      ? [{ key: spec.name, spec, onOpen: openEditor, onRename: undefined }]
      : state.projects.map((project) => ({
          key: project.fileName,
          spec: project.spec,
          onOpen: () => void handleOpenProject(project),
          onRename: () => void handleRename(project),
        }));
  const failures = state.kind === "ready" ? state.failures : [];

  if (cards.length === 0 && draftMode) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-surface-sunken px-6 text-content">
        <div className="text-center">
          <p className="text-lg font-semibold text-content-strong">자연어로 초안 만들기</p>
          <p className="mt-1 text-sm text-content-muted">만들고 싶은 화면을 설명해 주세요</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreateDraft();
          }}
          className="flex w-full max-w-sm flex-col gap-3"
        >
          <input
            ref={draftInputRef}
            type="text"
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            disabled={submittingDraft}
            autoFocus
            aria-label="자연어 초안 설명"
            placeholder="예: 로그인 화면 — 이메일, 비밀번호 입력창과 로그인 버튼이 있는 화면"
            className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-content placeholder:text-content-muted disabled:opacity-60"
          />
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-content-muted">예시</span>
            {HOME_DRAFT_EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                disabled={submittingDraft}
                onClick={() => {
                  setDraftText(example.text);
                  draftInputRef.current?.focus();
                }}
                className="rounded-control border border-line px-2 py-1 text-content hover:bg-hover disabled:opacity-50"
              >
                {example.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-content-muted">
            이 요청은 별도 터미널에서 실행한 Claude Code나 Codex가 처리합니다.
            아직 실행하지 않았다면 지금 준비해 두세요 — 에디터에서 준비되면
            지시를 복사해 전달할 수 있습니다.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={submittingDraft}
              onClick={() => {
                setDraftMode(false);
                setDraftText("");
              }}
              className="rounded-control border border-line px-3 py-1.5 text-sm text-content hover:bg-hover disabled:opacity-50"
            >
              뒤로
            </button>
            <button
              type="submit"
              disabled={draftText.trim() === "" || submittingDraft}
              className="rounded-control bg-primary px-3 py-1.5 text-sm font-medium text-text-on-accent hover:opacity-90 disabled:opacity-50"
            >
              초안 만들기
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-surface-sunken px-6 text-content">
        <div className="text-center">
          <p className="text-lg font-semibold text-content-strong">첫 프로젝트를 만들어 봅시다</p>
          <p className="mt-1 text-sm text-content-muted">어떻게 시작하시겠습니까?</p>
        </div>
        <div className="flex w-full max-w-sm flex-col divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
          <button
            type="button"
            onClick={() => setDraftMode(true)}
            className="flex flex-col gap-0.5 px-4 py-3 text-left hover:bg-hover"
          >
            <span className="text-sm font-medium text-content-strong">자연어로 초안 만들기</span>
            <span className="text-xs text-content-muted">설명을 입력하면 구조를 생성합니다</span>
          </button>
          <button
            type="button"
            onClick={() => void handleNewScreen()}
            className="flex flex-col gap-0.5 px-4 py-3 text-left hover:bg-hover"
          >
            <span className="text-sm font-medium text-content-strong">빈 캔버스에서 시작</span>
            <span className="text-xs text-content-muted">직접 요소를 배치합니다</span>
          </button>
          <button
            type="button"
            onClick={() => void handleOpenExisting()}
            className="flex flex-col gap-0.5 px-4 py-3 text-left hover:bg-hover"
          >
            <span className="text-sm font-medium text-content-strong">기존 프로젝트 불러오기</span>
            <span className="text-xs text-content-muted">JSON 파일을 엽니다</span>
          </button>
        </div>
        <div className="w-full max-w-sm">
          <CorruptedFilesSection failures={failures} onRetry={() => void refreshProjects()} />
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
          onClick={() => void handleNewScreen()}
          className="rounded-control bg-primary px-3 py-1.5 text-sm font-medium text-text-on-accent hover:opacity-90"
        >
          + 새 프로젝트
        </button>
      </header>

      <div ref={setScrollRoot} data-loading={state.kind === "ready" && state.loading ? "true" : undefined}
        className="flex-1 overflow-auto p-6">
        {message && <p role="alert" className="mb-4 text-sm">{message}</p>}
        <p className="mb-4 text-sm text-content-muted">
          프로젝트 {cards.length}개{state.kind === "ready" && state.loading ? " · 불러오는 중…" : ""}
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(208px,1fr))] gap-4">
          {cards.map((card) => (
            <ProjectCard key={card.key} spec={card.spec} onOpen={card.onOpen} onRename={card.onRename} disabled={renaming}
              scrollRoot={scrollRoot} drawn={drawnPreviews.current.has(card.key)}
              onDrawn={() => drawnPreviews.current.add(card.key)} />
          ))}
        </div>
        <CorruptedFilesSection failures={failures} onRetry={() => void refreshProjects()} />
      </div>
    </div>
  );
}

/** 읽기/검증에 실패해 카드가 되지 못한 파일을 사유와 함께 보여준다(#288). */
function CorruptedFilesSection({ failures, onRetry }: { failures: HomeProjectFailure[]; onRetry: () => void }) {
  if (failures.length === 0) return null;

  return (
    <div className="mt-6 rounded-panel border border-line bg-surface p-4">
      <p className="mb-2 text-sm font-medium text-content-strong">손상된 파일 {failures.length}개</p>
      <ul className="flex flex-col gap-2">
        {failures.map((failure) => (
          <li key={failure.fileName} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="truncate text-content">.visual-spec/specs/{failure.fileName}</p>
              <p className="text-xs text-content-muted">
                {failure.reason === "read-failed"
                  ? "파일을 읽을 수 없습니다."
                  : `올바른 프로젝트 파일이 아닙니다 (검증 실패 ${failure.issueCount}건).`}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="rounded-control border border-line px-2 py-1 text-xs hover:bg-hover"
              >
                다시 확인
              </button>
              {failure.reason === "invalid" && (
                <button
                  type="button"
                  onClick={() => downloadTextFile(failure.fileName, failure.rawText)}
                  className="rounded-control border border-line px-2 py-1 text-xs hover:bg-hover"
                >
                  원본 다운로드
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProjectCard({
  spec,
  onOpen,
  onRename,
  disabled,
  scrollRoot,
  drawn,
  onDrawn,
}: {
  spec: ProjectSpec;
  onOpen: () => void;
  onRename?: () => void;
  disabled: boolean;
  scrollRoot: Element | null;
  /** 이 카드의 미리보기를 이미 그린 적이 있다(이름 변경으로 다시 마운트된 경우 등). */
  drawn: boolean;
  onDrawn: () => void;
}) {
  // 열면 editorStore.loadSpec이 항상 pageOrder[0]을 활성 페이지로 잡는다
  // (editorStore.ts) — 그래서 카드 미리보기·크기도 같은 페이지를 기준으로
  // 삼는다. 클릭해서 열었을 때 보게 될 화면과 카드가 어긋나지 않는다.
  const coverPage = spec.pages[spec.pageOrder[0]];

  return (
    <div className="flex flex-col rounded-panel border border-line bg-surface">
    <button
      type="button"
      disabled={disabled}
      onClick={onOpen}
      className="flex flex-col gap-2 rounded-panel border border-line bg-surface p-2 text-left hover:border-primary"
    >
      <ProjectPreview page={coverPage} scrollRoot={scrollRoot} drawn={drawn} onDrawn={onDrawn} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-content-strong">
          {spec.name}
        </p>
        <p className="text-xs text-content-muted">
          페이지 {spec.pageOrder.length}개 · {coverPage.size.width}×
          {coverPage.size.height}
        </p>
      </div>
    </button>
    {onRename && <button type="button" disabled={disabled} onClick={onRename}
      aria-label={`${spec.name} 이름 변경`} className="px-2 py-1 text-left text-xs hover:bg-hover">이름 변경</button>}
    </div>
  );
}

/**
 * 요소가 스크롤 영역(`root`)의 보이는 부분 근처(위아래 `rootMargin`)에 한 번이라도 들어왔는가.
 * 한 번 들어오면 계속 true다 — 스크롤해 벗어날 때마다 미리보기를 지웠다 다시 그리지 않는다.
 * 기준을 브라우저 창이 아니라 카드 목록의 스크롤 요소로 잡는다 — 창을 기준으로 하면 그 요소가
 * 잘라 낸 바로 아래 카드가 "보이지 않음"으로 남아 `rootMargin`이 효과가 없다. 스크롤 요소가
 * 아직 없으면 기다린다. `IntersectionObserver`가 없는 환경(테스트 등)에서는 처음부터 true다.
 */
function useSeenOnce<T extends Element>(
  root: Element | null, initiallySeen = false, rootMargin = "200px",
): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(() => initiallySeen || typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (seen || root === null || ref.current === null) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
    }, { root, rootMargin });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [seen, root, rootMargin]);
  return [ref, seen];
}

/**
 * 캡처 이미지를 저장하지 않는다 — 스펙 JSON에서 매번 즉석 렌더한다(해결된 항목, docs/open-questions.md).
 *
 * 다만 화면 근처에 들어온 카드만 그린다(#315). 그리기 전에는 같은 크기의 빈 자리만 둔다.
 * 그리는 카드는 노드를 **전부** 그린다 — 노드를 일부만 그리면 row·grid 배치에서 보이는 영역이
 * 빠지거나, 남은 형제의 정렬(center·space-between 등)이 달라져 카드와 실제 화면이 어긋난다.
 */
function ProjectPreview({ page, scrollRoot, drawn, onDrawn }: {
  page: ScreenSpec; scrollRoot: Element | null; drawn: boolean; onDrawn: () => void;
}) {
  const { width, height } = page.size;
  const scale = previewScale(width, height, PREVIEW_WIDTH, PREVIEW_HEIGHT);
  const [ref, seen] = useSeenOnce<HTMLDivElement>(scrollRoot, drawn);
  useEffect(() => { if (seen) onDrawn(); }, [seen, onDrawn]);

  // 미리보기는 그림이다 — 카드 버튼의 접근 가능한 이름은 프로젝트 이름·페이지 정보로 충분하다.
  // 미리보기 안의 텍스트까지 이름에 들어가면 그렸는지(스크롤 위치)에 따라 이름이 바뀌고 매우 길어진다.
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-preview={seen ? "ready" : "pending"}
      className="relative overflow-hidden rounded-control bg-surface-canvas"
      style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
    >
      {seen && (
        <div
          className="absolute top-0 left-0"
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <PreviewNode id={page.root} nodes={page.nodes} />
        </div>
      )}
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

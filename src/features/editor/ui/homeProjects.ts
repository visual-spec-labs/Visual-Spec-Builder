import { migrateV01, type ProjectSpec } from "@/features/editor/schema";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { parseSpecJson } from "@/features/editor/store/loadSpec";
import { beginDocumentTransition } from "./documentTransition";
import { SPEC_DIR } from "@/features/workspace/protocol";
import { listWorkspaceFileEntries, readWorkspaceSpecSnapshot } from "./workspaceClient";

/** `specs/` 파일 하나를 카드에 쓸 수 있게 정규화한 것. */
export interface HomeProject {
  fileName: string;
  spec: ProjectSpec;
  diskRevision?: string;
}

/**
 * 못 읽거나 검증에 실패한 파일의 사유(#288). `readWorkspaceSpecSnapshot`이
 * 워크스페이스 미연결·네트워크 오류·HTTP 오류·revision 헤더 없음을 전부 `null`로
 * 뭉개므로(`workspaceClient.ts`) "읽기 실패"를 더 세분화할 근거 있는 정보가 없다.
 * "검증 실패"는 읽기는 됐으므로 원문(`rawText`)을 들고 있다 — 손상 파일 안내가
 * 원본 다운로드를 제공하는 유일한 경우다.
 */
export type HomeProjectFailure =
  | { fileName: string; reason: "read-failed" }
  | { fileName: string; reason: "invalid"; issueCount: number; rawText: string };

export type HomeProjectResult = ({ ok: true } & HomeProject) | ({ ok: false } & HomeProjectFailure);

/** 읽은 파일 하나를 ProjectSpec으로 정규화한다. 못 읽었거나 검증에 실패하면 사유를 돌려준다(#288). */
function toHomeProject(fileName: string, snapshot: { text: string; revision: string } | null): HomeProjectResult {
  if (snapshot === null) return { ok: false, fileName, reason: "read-failed" };

  const result = parseSpecJson(snapshot.text);
  if (!result.ok) return { ok: false, fileName, reason: "invalid", issueCount: result.issueCount, rawText: snapshot.text };

  const spec = "screen" in result.spec ? migrateV01(result.spec) : result.spec;
  return { ok: true, fileName, spec, diskRevision: snapshot.revision };
}

/**
 * `specs/`의 프로젝트 전부를 한 번에 읽는다. 작업공간이 없으면 null(호출자가 메모리 spec
 * 한 장으로 되돌아간다). 있으면 `{ projects, failures }`다(둘 다 비어 있을 수 있다 — projects가
 * 비면 상태 2). 못 읽거나 검증에 실패한 파일도 `failures`에 사유와 함께 남는다(#288) — 예전엔
 * 조용히 사라졌다. `loadWorkspaceProjectsProgressively`를 한 묶음(`firstBatch: Infinity`)으로
 * 부르는 얇은 래퍼다 — 양보할 "다음 묶음"이 없어 프레임을 기다릴 필요가 없다.
 */
export async function loadWorkspaceProjects({ signal }: { signal?: AbortSignal } = {}): Promise<{ projects: HomeProject[]; failures: HomeProjectFailure[] } | null> {
  let result: { projects: HomeProject[]; failures: HomeProjectFailure[] } = { projects: [], failures: [] };
  const exists = await loadWorkspaceProjectsProgressively(
    (projects, failures) => { result = { projects, failures }; },
    { firstBatch: Infinity, signal, isCancelled: () => signal?.aborted ?? false },
  );
  return exists ? result : null;
}

/**
 * 브라우저가 화면을 그리고(카드 미리보기의 IntersectionObserver 콜백·렌더 포함) 다시 돌아올 때까지
 * 기다린다 — 두 프레임. `setTimeout(0)`만으로는 다음 묶음의 파싱이 그리기보다 먼저 시작돼, 첫 묶음
 * 카드의 미리보기가 다음 묶음이 끝날 때까지 밀린다. 프레임이 없는 환경(테스트 등)은 다음 태스크.
 */
function nextFrames(): Promise<void> {
  // 숨긴 탭은 프레임이 오지 않는다 — 그대로 기다리면 돌아올 때까지 읽기가 멈춘다.
  const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
  if (typeof requestAnimationFrame !== "function" || hidden) return new Promise((resolve) => { setTimeout(resolve, 0); });
  // 기다리는 사이 탭이 숨겨져도 멈추지 않게 짧은 타이머와 겨룬다(먼저 오는 쪽).
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, 100);
  });
}

/**
 * 묶음 크기(#316). 첫 묶음은 첫 화면을 한 번에 채울 만큼(`homeFirstBatch`), 그 뒤는 크게 —
 * 묶음마다 목록을 다시 그리고 프레임을 기다리므로 묶음이 잘수록 전체 완료가 늦어진다.
 */
export const HOME_PARSE_BATCH = 50;

/**
 * 창 크기로 어림한 첫 화면 카드 수. 홈 카드 격자(`HomeScreen`의 minmax(208px) 열 + 16px 간격,
 * 좌우 여백 24px씩)와 카드 높이(약 240px, 간격 포함)로 열 수 × (보이는 행 + 1)이다. 창을 모르면 24.
 */
export function homeFirstBatch(width = typeof window === "undefined" ? 0 : window.innerWidth,
  height = typeof window === "undefined" ? 0 : window.innerHeight): number {
  if (width <= 0 || height <= 0) return 24;
  const columns = Math.max(1, Math.floor((width - 48 + 16) / (208 + 16)));
  const rows = Math.ceil(height / 240) + 1;
  return Math.max(12, columns * rows);
}

/**
 * `loadWorkspaceProjects`와 같은 결과를 **앞에서부터 묶음으로** 낸다(#316).
 *
 * 프로젝트가 많고 크면(100개 × 노드 1000) 홈 진입 시간의 큰 몫이 파일마다의 JSON 파싱과 스키마
 * 검증이다(docs/22-performance-baseline.md). 파일은 한꺼번에 요청해 두고, 파싱·검증은 카드 순서
 * (최근 수정순)대로 첫 묶음 `firstBatch`개, 그 뒤 `batch`개씩 하며 묶음 사이에 이벤트 루프를 양보한다. 그래서 첫 화면 카드가
 * 나머지를 기다리지 않고 먼저 그려진다.
 *
 * 묶음이 끝날 때마다 `onProgress(지금까지의 목록, 지금까지의 손상 파일, 다 읽었는가)`를 부른다.
 * 둘 다 매번 새 배열이고 순서는 최종 순서와 같다 — 이미 낸 항목의 순서는 바뀌지 않는다(뒤에 이어
 * 붙기만 한다). 마지막 호출의 `done`은 true다. `isCancelled()`가 true가 되면 그 자리에서 멈춘다.
 * 작업공간이 없으면 `onProgress`를 부르지 않고 false다.
 */
export async function loadWorkspaceProjectsProgressively(
  onProgress: (projects: HomeProject[], failures: HomeProjectFailure[], done: boolean) => void,
  { firstBatch = homeFirstBatch(), batch = HOME_PARSE_BATCH, isCancelled = () => false, signal }:
    { firstBatch?: number; batch?: number; isCancelled?: () => boolean; signal?: AbortSignal } = {},
): Promise<boolean> {
  const entries = await listWorkspaceFileEntries(SPEC_DIR);
  if (entries === null) return false;

  const ordered = [...entries].sort((a, b) =>
    b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name),
  );
  // 읽기는 한꺼번에 시작한다 — 파싱이 앞 묶음을 하는 동안 뒤 파일이 도착한다.
  // 취소(`signal`)하면 아직 내려받는 요청도 멈춘다.
  const snapshots = ordered.map((entry) => readWorkspaceSpecSnapshot(`${SPEC_DIR}/${entry.name}`, signal));
  const projects: HomeProject[] = [];
  const failures: HomeProjectFailure[] = [];
  for (let start = 0, size = firstBatch; start < ordered.length || start === 0; start += size, size = batch) {
    for (let index = start; index < Math.min(start + size, ordered.length); index += 1) {
      const result = toHomeProject(ordered[index].name, await snapshots[index]);
      if (result.ok) projects.push(result);
      else failures.push(result);
    }
    if (isCancelled()) return true;
    const done = start + size >= ordered.length;
    onProgress([...projects], [...failures], done);
    if (done) break;
    await nextFrames();
    if (isCancelled()) return true;
  }
  return true;
}

/**
 * 홈 카드 하나를 연다. 카드는 목록을 만들 때 이미 내용을 읽어 뒀다 — 다시 읽지 않고
 * 그 spec을 그대로 loadSpec에 넘긴다. setFileName으로 "지금 연 파일"을 기억시켜야
 * 그 뒤의 File ▸ Save가 이 파일에 그대로 쓴다(documentStore.ts, 이슈 #185).
 *
 * 갈아 끼우기 전에 현재 문서의 대기 중 자동저장을 먼저 끝내고, 지금 파일을 다시 여는
 * 경우 남은 초안을 비교하게 파일명을 넘긴다(#267). false면 현재 문서를 그대로 둔다.
 */
export async function openHomeProject(project: HomeProject): Promise<boolean> {
  const transition = beginDocumentTransition();
  if (!await transition.settle(project.fileName) || !transition.current()) return false;
  useEditorStore.getState().loadSpec(project.spec);
  useDocumentStore.getState().setFileName(project.fileName, project.diskRevision);
  return true;
}

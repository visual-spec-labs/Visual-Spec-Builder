/**
 * 열린 파일이 디스크에서 바뀐 것을 감지해 안전하게 가져온다 (이슈 #279 2/2).
 *
 * 에이전트나 다른 도구가 `.visual-spec/specs/<파일>`을 직접 고치면 열린 GUI는 그 사실을
 * 몰랐다 — 계속 옛 내용을 보여 주다가 저장 때 디스크 충돌(CAS)로만 알게 된다. 에디터 화면에서
 * 이름 있는 파일을 열고 있는 동안 디스크 버전을 주기적으로 확인한다.
 *
 * - 디스크 내용이 지금 화면과 같다(방금 내가 저장했다): 버전만 조용히 맞춘다.
 * - 미저장 편집이 없다: 디스크 내용을 **Undo 한 단계로** 불러오고 알린다(되돌리기 가능).
 * - 미저장 편집이 있다: 불러올지 묻는다. 유지하면 그 버전은 다시 묻지 않고, 다음 저장이
 *   기존 디스크 충돌 대화상자로 이어진다 — 어느 쪽이든 사용자가 고른 것만 바뀐다.
 * - 검증에 실패하는 내용: 불러오지 않고 알리기만 한다.
 *
 * "미저장 편집"은 디스크에 **실제로 쓰인 내용**과 지금 화면 내용을 비교해 판단한다. 열기·저장·
 * 이름 변경으로 파일명이나 디스크 버전이 바뀌면 그 버전의 디스크 내용을 읽어 기준으로 삼는다 —
 * 그 순간의 메모리를 기준으로 삼으면 이름 변경이나 저장 도중의 미저장 편집이 "저장됨"으로
 * 둔갑한다(#279 리뷰). 기준을 읽기 전에는 미저장 편집이 있는 것으로 보고 묻는다.
 */

import { migrateV01 } from "@/features/editor/schema";
import type { ProjectSpec } from "@/features/editor/schema";
import { useAgentEditStore } from "@/features/editor/store/agentEditStore";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { parseSpecJson } from "@/features/editor/store/loadSpec";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { SPEC_DIR } from "@/features/workspace/protocol";

import { startTicker } from "./ticker";
import { isWorkspaceAvailable, readWorkspaceSpecSnapshot } from "./workspaceClient";

/** 디스크 버전을 확인하는 간격. 에이전트가 파일을 고친 뒤 GUI에 보이기까지의 지연이다. */
export const DISK_WATCH_MS = 3000;

export function startDiskWatch(): () => void {
  let stopped = false;
  let checking = false;
  /**
   * 지금 디스크 버전의 내용(JSON). 지금 화면과 다르면 미저장 편집이 있다. 모르면 null — 시작
   * 시점(새로고침으로 복원한 문서는 미저장 편집일 수 있다)이나 기준을 읽는 중이다.
   */
  let baselineJson: string | null = null;
  let baselineRevision: string | null = null;
  /** 사용자가 "내 편집 유지"를 고른 디스크 버전 — 같은 버전으로 다시 묻지 않는다. */
  let keptRevision: string | null = null;
  let stopTicker: (() => void) | undefined;

  const toJson = (spec: ProjectSpec) => JSON.stringify(spec);
  function parseDisk(text: string): ProjectSpec | null {
    const parsed = parseSpecJson(text);
    if (!parsed.ok) return null;
    return "screen" in parsed.spec ? migrateV01(parsed.spec) : parsed.spec;
  }

  /** 지금 문서의 디스크 버전 내용을 읽어 기준으로 삼는다. 읽는 동안 기준은 모른다. */
  async function refreshBaseline() {
    baselineJson = null;
    baselineRevision = null;
    keptRevision = null;
    const { fileName, diskRevision } = useDocumentStore.getState();
    if (fileName === null || diskRevision === null) return;
    const snapshot = await readWorkspaceSpecSnapshot(`${SPEC_DIR}/${fileName}`);
    const now = useDocumentStore.getState();
    if (stopped || snapshot === null || now.fileName !== fileName || now.diskRevision !== diskRevision) return;
    if (snapshot.revision !== diskRevision) return; // 그 사이 디스크가 또 바뀌었다 — 감시가 처리한다
    const spec = parseDisk(snapshot.text);
    if (spec === null) return;
    baselineJson = toJson(spec);
    baselineRevision = diskRevision;
  }
  // 열기·저장·이름 변경·불러오기는 모두 파일명이나 디스크 버전을 새로 정한다.
  const unsubscribeDocument = useDocumentStore.subscribe((s, prev) => {
    if (s.fileName !== prev.fileName || s.diskRevision !== prev.diskRevision) {
      // 문서나 디스크 버전이 바뀌었으면(저장·충돌 덮어쓰기·다른 파일 열기) 떠 있던 "불러올까요"는
      // 낡았다 — 그대로 두면 지난 버전을 불러와 화면과 버전이 디스크와 어긋난다(#279 리뷰).
      const shown = useAgentEditStore.getState().diskNotice;
      if (shown?.kind === "diskChanged" && (shown.fileName !== s.fileName || shown.baseRevision !== s.diskRevision)) {
        useAgentEditStore.setState({ diskNotice: null });
      }
      if (baselineRevision !== s.diskRevision || s.fileName !== prev.fileName) void refreshBaseline();
    }
  });

  function adopt(fileName: string, spec: ProjectSpec, revision: string) {
    useEditorStore.getState().replaceSpecFromOutside(spec);
    // 방금 디스크에서 읽은 내용 그대로다 — 다시 읽지 않고 기준으로 삼는다.
    baselineJson = toJson(spec);
    baselineRevision = revision;
    keptRevision = null;
    useDocumentStore.getState().setFileName(fileName, revision);
  }

  async function check() {
    if (stopped || checking) return;
    const { fileName, diskRevision } = useDocumentStore.getState();
    if (fileName === null || useNavigationStore.getState().screen !== "editor") return;
    if (useSaveConflictStore.getState().paused) return; // 충돌 대화상자가 이미 사용자에게 묻고 있다
    checking = true;
    try {
      const snapshot = await readWorkspaceSpecSnapshot(`${SPEC_DIR}/${fileName}`);
      if (stopped || snapshot === null) return;
      // 기다리는 사이 다른 문서로 옮겼거나 저장으로 버전이 바뀌었으면 이번 결과는 쓰지 않는다.
      const now = useDocumentStore.getState();
      if (now.fileName !== fileName || now.diskRevision !== diskRevision) return;
      if (snapshot.revision === diskRevision) {
        // 열기·저장 뒤 기준 읽기가 실패했으면(일시 오류) 여기서 다시 잡는다 — 그러지 않으면 다음
        // 열기·저장 전까지 바깥 변경을 모두 "미저장 편집이 있다"로 묻는다(#279 리뷰).
        if (baselineRevision !== diskRevision) {
          const spec = parseDisk(snapshot.text);
          if (spec !== null) { baselineJson = toJson(spec); baselineRevision = diskRevision; }
        }
        return;
      }
      if (snapshot.revision === keptRevision) return;
      // 같은 버전을 이미 묻고 있다 — 3초마다 다시 띄우지 않는다(#279 리뷰).
      const shown = useAgentEditStore.getState().diskNotice;
      if (shown?.kind === "diskChanged" && shown.revision === snapshot.revision) return;

      const parsed = parseSpecJson(snapshot.text);
      if (!parsed.ok) {
        keptRevision = snapshot.revision;
        useAgentEditStore.setState({ diskNotice: { kind: "diskInvalid", fileName, issueCount: parsed.issueCount } });
        return;
      }
      const spec = "screen" in parsed.spec ? migrateV01(parsed.spec) : parsed.spec;
      const currentJson = toJson(useEditorStore.getState().spec);
      if (toJson(spec) === currentJson) {
        baselineJson = currentJson;
        baselineRevision = snapshot.revision;
        useDocumentStore.getState().setFileName(fileName, snapshot.revision); // 내가 방금 저장한 내용
        return;
      }
      if (baselineJson !== null && baselineRevision === diskRevision && currentJson === baselineJson) {
        adopt(fileName, spec, snapshot.revision);
        useAgentEditStore.setState({ diskNotice: { kind: "diskImported", fileName, spec: useEditorStore.getState().spec } });
        return;
      }
      useAgentEditStore.setState({ diskNotice: { kind: "diskChanged", fileName, baseRevision: diskRevision, revision: snapshot.revision, spec } });
    } finally {
      checking = false;
    }
  }

  useAgentEditStore.setState({
    resolveDiskChange: (load) => {
      const notice = useAgentEditStore.getState().diskNotice;
      if (notice?.kind !== "diskChanged") return;
      useAgentEditStore.setState({ diskNotice: null });
      const doc = useDocumentStore.getState();
      if (doc.fileName !== notice.fileName || doc.diskRevision !== notice.baseRevision) return;
      if (!load) { keptRevision = notice.revision; return; }
      adopt(notice.fileName, notice.spec, notice.revision);
    },
  });

  void (async () => {
    if (!await isWorkspaceAvailable() || stopped) return;
    stopTicker = startTicker(DISK_WATCH_MS, () => { void check(); });
  })();

  return () => {
    stopped = true;
    stopTicker?.();
    unsubscribeDocument();
  };
}

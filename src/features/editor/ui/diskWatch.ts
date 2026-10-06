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
 * "미저장 편집"은 마지막으로 디스크와 맞춘 순간(열기·저장·불러오기)의 spec 참조와 지금 spec
 * 참조가 다른가로 판단한다 — 편집·Undo는 새 참조를 만든다.
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
   * 마지막으로 디스크와 맞춘 순간의 spec. 지금 spec과 다르면 미저장 편집이 있다. 시작 시점엔
   * 모른다(null) — 새로고침으로 탭 복구에서 되살린 문서는 미저장 편집일 수 있으므로, 열기·저장으로
   * 맞추기 전까지는 디스크 변경을 묻지 않고 불러오지 않는다.
   */
  let baselineSpec: ProjectSpec | null = null;
  /** 사용자가 "내 편집 유지"를 고른 디스크 버전 — 같은 버전으로 다시 묻지 않는다. */
  let keptRevision: string | null = null;
  let stopTicker: (() => void) | undefined;

  const markInSync = () => { baselineSpec = useEditorStore.getState().spec; keptRevision = null; };
  // 열기·저장·불러오기는 모두 파일명이나 디스크 버전을 새로 정한다 — 그 순간이 디스크와 맞춘 기준이다.
  const unsubscribeDocument = useDocumentStore.subscribe((s, prev) => {
    if (s.fileName !== prev.fileName || s.diskRevision !== prev.diskRevision) markInSync();
  });

  function adopt(fileName: string, spec: ProjectSpec, revision: string) {
    useEditorStore.getState().replaceSpecFromOutside(spec);
    useDocumentStore.getState().setFileName(fileName, revision); // markInSync가 기준을 옮긴다
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
      if (snapshot.revision === diskRevision || snapshot.revision === keptRevision) return;

      const parsed = parseSpecJson(snapshot.text);
      if (!parsed.ok) {
        keptRevision = snapshot.revision;
        useAgentEditStore.setState({ notice: { kind: "diskInvalid", fileName, issueCount: parsed.issueCount } });
        return;
      }
      const spec = "screen" in parsed.spec ? migrateV01(parsed.spec) : parsed.spec;
      const current = useEditorStore.getState().spec;
      if (JSON.stringify(spec) === JSON.stringify(current)) {
        useDocumentStore.getState().setFileName(fileName, snapshot.revision); // 내가 방금 저장한 내용
        return;
      }
      if (current === baselineSpec) {
        adopt(fileName, spec, snapshot.revision);
        useAgentEditStore.setState({ notice: { kind: "diskImported", fileName, spec: useEditorStore.getState().spec } });
        return;
      }
      useAgentEditStore.setState({ notice: { kind: "diskChanged", fileName, revision: snapshot.revision, spec } });
    } finally {
      checking = false;
    }
  }

  useAgentEditStore.setState({
    resolveDiskChange: (load) => {
      const notice = useAgentEditStore.getState().notice;
      if (notice?.kind !== "diskChanged") return;
      useAgentEditStore.setState({ notice: null });
      if (useDocumentStore.getState().fileName !== notice.fileName) return;
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

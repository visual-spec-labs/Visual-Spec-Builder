import { useState } from "react";

import type { VerifyIssue, VerifyReport } from "@/features/editor/export/verifyGenerated";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useExportStore } from "@/features/editor/store/exportStore";
import { downloadGeneratedBundle } from "@/features/editor/ui/exportGeneratedCode";

function IssueRow({ issue }: { issue: VerifyIssue }) {
  const where = issue.line === undefined ? issue.file : `${issue.file}:${issue.line}`;
  const isError = issue.severity === "error";

  return (
    <li className="rounded-panel border border-line bg-surface-raised p-2">
      <p className="flex items-center gap-2 text-xs">
        <span
          className={`rounded-control px-1.5 py-0.5 ${
            isError ? "bg-error text-text-on-status" : "bg-surface text-content-muted"
          }`}
        >
          {isError ? "오류" : "참고"}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-content-strong" title={where}>
          {where}
        </span>
      </p>
      <p className="mt-1 text-xs text-content-muted">{issue.message}</p>
    </li>
  );
}

function Summary({ report }: { report: VerifyReport }) {
  return (
    <p className="text-xs text-content-muted">
      파일 {report.fileCount}개 · 티켓 {report.coverage.length}개 중 {report.coveredCount}개 포함 ·{" "}
      <span className={report.errorCount > 0 ? "text-error" : undefined}>
        오류 {report.errorCount}건
      </span>
    </p>
  );
}

/**
 * 생성된 React 코드를 훑어 검증 결과를 보여주고 ZIP으로 내보낸다(#157).
 *
 * **비어 있는 것이 기본 상태다.** `.visual-spec/generated/`를 채우는 것은 외부
 * 에이전트이고(#156의 A안) 아직 아무것도 만들지 않은 시점이 정상이다. 그래서
 * "파일 0개"를 오류로 그리지 않고 **무엇을 해야 하는지**와 **무엇이 있어야 하는지**
 * (티켓별 기대 경로)를 보여준다.
 *
 * TicketPanel과 같은 우측 영역을 쓴다 — 기존 배치를 바꾸지 않는다.
 */
export function ExportPanel() {
  const page = useEditorStore((state) => state.spec.pages[state.activePageId]);
  const status = useExportStore((state) => state.status);
  const files = useExportStore((state) => state.files);
  const report = useExportStore((state) => state.report);
  const target = useExportStore((state) => state.target);
  const rescan = useExportStore((state) => state.rescan);
  const close = useExportStore((state) => state.close);

  const [isDownloading, setIsDownloading] = useState(false);

  // 티켓 누락(`missing-file`)은 바로 위 커버리지 목록이 이미 줄마다 보여준다 —
  // 아래 목록에 또 늘어놓으면 그 4줄에 밀려 정작 고칠 문제가 화면 밖으로 나간다.
  // README에는 둘 다 실린다(거기선 표가 하나뿐이라 겹치지 않는다).
  const otherIssues = report?.issues.filter((issue) => issue.code !== "missing-file") ?? [];

  function handleDownload() {
    if (report === null || target === null) return;
    setIsDownloading(true);
    void downloadGeneratedBundle(target.projectName, files, report).finally(() =>
      setIsDownloading(false),
    );
  }

  return (
    <aside className="flex flex-col overflow-hidden border-l border-line bg-surface [grid-area:props]">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold tracking-wide text-content-muted uppercase">
            Code export
          </h2>
          <p className="truncate text-xs text-content-subtle">{page.name}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const { documentId, activePageId, spec } = useEditorStore.getState();
            void rescan({
              documentId,
              pageId: activePageId,
              page: spec.pages[activePageId],
              projectName: spec.name,
            });
          }}
          disabled={status === "scanning"}
          className="rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-hover disabled:opacity-50"
        >
          다시 검사
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="코드 Export 닫기"
          className="rounded-control px-2 py-1 text-content-muted hover:bg-hover hover:text-content"
        >
          ×
        </button>
      </header>

      <div className="flex-1 overflow-auto p-3">
        {status === "scanning" && <p className="text-sm text-content-subtle">훑는 중…</p>}

        {status === "no-workspace" && (
          <p className="text-sm text-content-subtle">
            작업공간에 연결돼 있지 않습니다. <code>npx visual-spec</code>으로 띄운 개발 서버에서만
            생성된 코드를 읽을 수 있습니다.
          </p>
        )}

        {status === "idle" && (
          <p className="text-sm text-content-subtle">
            스펙이 수정되거나 문서·페이지가 바뀌어 이전 검사 결과를 지웠습니다. 현재 페이지를 다시
            검사해 주세요.
          </p>
        )}

        {status === "ready" && report !== null && (
          <div className="flex flex-col gap-3">
            <Summary report={report} />

            {report.fileCount === 0 && (
              <p className="rounded-panel border border-line bg-surface-raised p-3 text-xs text-content-muted">
                <code>.visual-spec/generated/</code>가 비어 있습니다. 구현 티켓을 외부 에이전트로
                구현해 아래 경로에 저장하면 여기에서 검증하고 내보낼 수 있습니다.
              </p>
            )}

            <section>
              <h3 className="mb-1 text-xs font-semibold text-content-strong">티켓 커버리지</h3>
              {report.coverage.length === 0 ? (
                <p className="text-xs text-content-subtle">구현 티켓이 없습니다.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {report.coverage.map((entry) => (
                    <li
                      key={entry.ticketId}
                      className="flex items-center gap-2 rounded-panel border border-line bg-surface-raised px-2 py-1"
                    >
                      <span
                        className="min-w-0 flex-1 truncate font-mono text-xs text-content"
                        title={entry.expectedPath}
                      >
                        {entry.expectedPath}
                      </span>
                      <span
                        className={`shrink-0 text-xs ${
                          entry.found ? "text-content-muted" : "text-error"
                        }`}
                      >
                        {entry.found ? "있음" : "없음"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {otherIssues.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-semibold text-content-strong">
                  검증 결과 {otherIssues.length}건
                </h3>
                <ul className="flex flex-col gap-1">
                  {otherIssues.map((issue, index) => (
                    <IssueRow key={`${issue.code}-${issue.file}-${issue.line ?? index}`} issue={issue} />
                  ))}
                </ul>
              </section>
            )}

            <button
              type="button"
              onClick={handleDownload}
              disabled={report.fileCount === 0 || isDownloading}
              className="rounded-control border border-line bg-surface-raised px-2 py-2 text-xs text-content-strong hover:bg-hover disabled:opacity-50"
            >
              {isDownloading ? "만드는 중…" : "결과 폴더 ZIP 내려받기"}
            </button>
          </div>
        )}
      </div>

      <p className="border-t border-line px-3 py-2 text-xs text-content-subtle">
        타입 검사·lint·화면 비교는 하지 않습니다. 대상 프로젝트 설정이 필요해 앱 안에서 답을 낼 수
        없습니다.
      </p>
    </aside>
  );
}

import { useState } from "react";

import { compileTickets } from "@/features/editor/ticket/compileTickets";
import type {
  FreshnessReport,
  OverallFreshness,
  TicketFreshness,
} from "@/features/editor/export/generationManifest";
import type { VerifyIssue, VerifyReport } from "@/features/editor/export/verifyGenerated";
import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useExportStore } from "@/features/editor/store/exportStore";
import { downloadGeneratedBundle, type GeneratedLocation } from "@/features/editor/ui/exportGeneratedCode";
import { HandoffStageIndicator } from "@/features/editor/ui/HandoffStageIndicator";
import { openTicketPanel } from "@/features/editor/ui/openTicketPanel";

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
 * 생성 세대 확인 문구(#284, docs/26 "Export 생성 세대 판정"). 파일·참조 검사 요약과 따로 보인다 —
 * 4/4·오류 0이어도 취소된 요청이 늦게 쓴 파일이나 입력이 바뀐 뒤의 파일일 수 있다.
 */
const FRESHNESS_SUMMARY: Record<OverallFreshness, string> = {
  empty: "구현 티켓이 없어 확인할 생성 파일이 없습니다.",
  current: "현재 — 모든 티켓 파일이 GUI가 수용한 요청의 출력 그대로이고, 그 요청의 입력이 지금 화면과 같습니다.",
  missing: "아직 없음 — 구현 티켓을 에이전트에 전달해 확정된 생성 파일이 없습니다.",
  partial: "부분 — 일부 티켓만 지금 화면으로 생성·확정됐습니다. 나머지 티켓을 전달하세요.",
  stale: "오래됨 — 확정한 뒤 화면이 바뀌었습니다. 티켓을 다시 생성해 전달해야 최신 결과가 됩니다.",
  unverifiable:
    "확인 불가 — GUI가 수용하지 않았거나 이 프로젝트·페이지의 것인지 확인할 수 없는 파일이 있습니다(취소·만료된 요청의 늦은 출력, 직접 수정, 직접 실행한 생성, 다른 프로젝트의 출력 등). 파일·참조 검사와 별개로 최신 생성 완료로 보지 않습니다.",
};

const TICKET_FRESHNESS_LABEL: Record<TicketFreshness, string> = {
  current: "현재",
  stale: "오래됨",
  renamed: "이전 이름 파일만 있음",
  changed: "확정 뒤 바뀜",
  foreign: "다른 프로젝트·페이지의 기록",
  unrecorded: "기록 없음",
  missing: "없음",
};

/** 생성 자리 안내(#281). 이전 배치·후보 폴더는 왜 "현재"가 될 수 없는지 함께 말한다. */
function locationText(location: GeneratedLocation): string {
  if (location.layout === "legacy") {
    return "이전 배치(generated/pages·components)의 파일입니다. 어느 프로젝트·페이지의 것인지 기록이 없어 최신 생성으로 보지 않습니다. 구현 티켓을 다시 전달하면 이 페이지의 자리에 새로 만듭니다.";
  }
  if (location.layout === "unassigned") {
    return "이 문서의 생성 자리가 아직 없습니다. 구현 티켓을 처음 전달할 때 정해집니다.";
  }
  if (location.layout === "project" && location.projectId === null) {
    return `생성 위치: generated/${location.root}/ — GUI로 전달한 적이 없는 프로젝트라 수용 기록이 없습니다.`;
  }
  return location.layout === "project" ? `생성 위치: generated/${location.root}/` : "";
}

function FreshnessSummary({ freshness, location }: { freshness: FreshnessReport; location: GeneratedLocation | null }) {
  const settled = freshness.overall === "current" || freshness.overall === "empty";
  return (
    <section aria-label="생성 세대 확인" className="rounded-panel border border-line bg-surface-raised p-2">
      <h3 className="text-xs font-semibold text-content-strong">생성 세대 확인</h3>
      <p className={`mt-1 text-xs ${settled ? "text-content-muted" : "text-error"}`}>
        {FRESHNESS_SUMMARY[freshness.overall]}
      </p>
      {location !== null && location.layout !== "all" && (
        <p className="mt-1 break-all text-xs text-content-muted">{locationText(location)}</p>
      )}
      {freshness.superseded.length > 0 && (
        <ul aria-label="더 이상 쓰지 않는 이전 출력" className="mt-1 flex flex-col gap-0.5">
          {freshness.superseded.map((output) => (
            <li key={output.path} className="break-all text-xs text-content-muted">
              {output.reason === "renamed"
                ? `이름이 바뀐 컴포넌트의 이전 파일: ${output.path} → ${output.currentPath}`
                : `지금 티켓에 없는 컴포넌트의 파일: ${output.path}`}
              {output.changed && " (확정 뒤 수정됨 — 새 파일로 옮겨지지 않습니다)"}
            </li>
          ))}
        </ul>
      )}
    </section>
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
  const freshness = useExportStore((state) => state.freshness);
  const location = useExportStore((state) => state.location);
  const target = useExportStore((state) => state.target);
  const rescan = useExportStore((state) => state.rescan);
  const close = useExportStore((state) => state.close);

  const [isDownloading, setIsDownloading] = useState(false);
  const [assetFailure, setAssetFailure] = useState<{
    report: VerifyReport;
    target: NonNullable<typeof target>;
    names: string[];
  } | null>(null);
  const unavailableAssets = assetFailure?.report === report && assetFailure.target === target
    ? assetFailure.names
    : [];

  // 티켓 누락(`missing-file`)은 바로 위 커버리지 목록이 이미 줄마다 보여준다 —
  // 아래 목록에 또 늘어놓으면 그 4줄에 밀려 정작 고칠 문제가 화면 밖으로 나간다.
  // README에는 둘 다 실린다(거기선 표가 하나뿐이라 겹치지 않는다).
  const otherIssues = report?.issues.filter((issue) => issue.code !== "missing-file") ?? [];
  const freshnessByTicket = new Map(freshness?.tickets.map((entry) => [entry.ticketId, entry.freshness]));
  // 주 동작 강조는 파일·참조 오류가 없고 생성 세대도 현재일 때만이다(#284). 내려받기 자체는 막지 않는다.
  const exportReady = report !== null && report.errorCount === 0 &&
    (freshness === null || freshness.overall === "current");

  async function handleDownload(allowPartial = false) {
    if (report === null || target === null) return;
    setIsDownloading(true);
    try {
      const result = await downloadGeneratedBundle(
        target.projectName,
        files,
        report,
        compileTickets(page),
        allowPartial,
      );
      setAssetFailure(result.missing.length === 0 ? null : { report, target, names: result.missing });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <aside className="flex flex-col overflow-hidden border-l border-line bg-surface [grid-area:props]">
      <header className="flex items-center gap-2 border-b border-line px-3 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold tracking-wide text-content-muted uppercase">
            Code export
          </h2>
          <p className="truncate text-xs text-content-muted">{page.name}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAssetFailure(null);
            const { documentId, activePageId, spec } = useEditorStore.getState();
            void rescan({
              documentId,
              pageId: activePageId,
              page: spec.pages[activePageId],
              projectName: spec.name,
              fileName: useDocumentStore.getState().fileName,
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

      <HandoffStageIndicator current="export" />

      <div className="flex-1 overflow-auto p-3">
        {status === "scanning" && <p className="text-sm text-content-muted">훑는 중…</p>}

        {status === "no-workspace" && (
          <p className="text-sm text-content-muted">
            작업공간에 연결돼 있지 않습니다. <code>npx visual-spec</code>으로 띄운 개발 서버에서만
            생성된 코드를 읽을 수 있습니다.
          </p>
        )}

        {status === "idle" && (
          <p className="text-sm text-content-muted">
            스펙이 수정되거나 문서·페이지가 바뀌어 이전 검사 결과를 지웠습니다. 현재 페이지를 다시
            검사해 주세요.
          </p>
        )}

        {status === "ready" && report !== null && (
          <div className="flex flex-col gap-3">
            <Summary report={report} />

            {freshness !== null && <FreshnessSummary freshness={freshness} location={location} />}

            {report.fileCount === 0 && (
              <p className="rounded-panel border border-line bg-surface-raised p-3 text-xs text-content-muted">
                아직 생성된 코드가 없습니다. 이전 단계(에이전트 전달)에서 구현 티켓을
                에이전트에 전달하고 처리되면 여기서 검증할 수 있습니다.{" "}
                <button type="button" onClick={openTicketPanel} className="underline hover:text-content">
                  구현 티켓 열기
                </button>
              </p>
            )}

            <section>
              <h3 className="mb-1 text-xs font-semibold text-content-strong">티켓 커버리지</h3>
              {report.coverage.length === 0 ? (
                <p className="text-xs text-content-muted">구현 티켓이 없습니다.</p>
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
                        {/* 파일이 있을 때만 세대 판정을 덧붙인다 — 없음은 이미 "없음"이다. */}
                        {entry.found && freshnessByTicket.has(entry.ticketId) &&
                          ` · ${TICKET_FRESHNESS_LABEL[freshnessByTicket.get(entry.ticketId) ?? "missing"]}`}
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

            {unavailableAssets.length > 0 && (
              <section role="alert" className="rounded-panel border border-error/40 bg-surface-raised p-3">
                <h3 className="text-xs font-semibold text-error">이미지 자산을 읽지 못했습니다</h3>
                <p className="mt-1 text-xs text-content-muted">
                  전체 ZIP을 만들지 않았습니다. 자산을 복구한 뒤 다시 시도하거나, 누락 이미지를
                  README에 기록한 부분 ZIP을 받을 수 있습니다. 부분 ZIP은 이미지 import가 해결되지
                  않아 그대로 실행하면 이미지가 표시되지 않습니다.
                </p>
                <ul className="mt-2 list-inside list-disc text-xs text-content-strong">
                  {unavailableAssets.map((name) => <li key={name} className="font-mono">{name}</li>)}
                </ul>
                <button
                  type="button"
                  onClick={() => void handleDownload(true)}
                  disabled={isDownloading}
                  className="mt-2 rounded-control border border-line px-2 py-1 text-xs text-content-strong hover:bg-hover disabled:opacity-50"
                >
                  이미지 없이 부분 ZIP 받기
                </button>
              </section>
            )}

            <button
              type="button"
              onClick={() => void handleDownload(false)}
              disabled={report.fileCount === 0 || isDownloading}
              // 오류 없이 준비된 상태의 주 동작이다(#283) — 강조색을 쓴다. 오류가
              // 남아 있거나 생성 세대가 현재가 아니면(#284) 중립 스타일로 물러난다.
              className={`rounded-control px-2 py-2 text-xs disabled:opacity-50 ${
                exportReady
                  ? "bg-primary text-text-on-accent hover:opacity-90"
                  : "border border-line bg-surface-raised text-content-strong hover:bg-hover"
              }`}
            >
              {isDownloading
                ? "자산 확인 및 ZIP 만드는 중…"
                : unavailableAssets.length > 0
                  ? "전체 ZIP 다시 시도"
                  : "결과 폴더 ZIP 내려받기"}
            </button>
          </div>
        )}
      </div>

      <p className="border-t border-line px-3 py-2 text-xs text-content-muted">
        결과는 실행 앱이 아니라 화면 컴포넌트 묶음입니다 — 앱 셸·라우터 설정·폼 동작·데이터 불러오기·
        인증·백엔드·상태 스타일·배포 설정은 들어 있지 않습니다. 타입 검사·lint·화면 비교는 하지 않습니다. 대상 프로젝트 설정이 필요해 앱
        안에서 답을 낼 수 없습니다.
      </p>
    </aside>
  );
}

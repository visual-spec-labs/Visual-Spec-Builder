import { useState } from "react";

import { diffLines, type DiffLine } from "@/features/editor/export/lineDiff";
import {
  needsDecision,
  type OverwriteDecision,
  type OverwriteOwnership,
  type OverwriteReview,
  type OverwriteReviewItem,
} from "@/features/editor/export/overwriteGuard";
import type { OverwriteAnswer } from "@/features/editor/ui/ticketRunner";

const OWNERSHIP_LABEL: Record<OverwriteOwnership, string> = {
  new: "새 파일",
  unchanged: "내용 같음 — 쓰지 않음",
  owned: "마지막 생성 그대로 — 백업 후 교체",
  modified: "수동 변경됨",
  unowned: "생성 기록 없음",
  foreign: "다른 프로젝트·페이지의 기록",
};

const OWNERSHIP_HINT: Partial<Record<OverwriteOwnership, string>> = {
  modified: "마지막으로 수용한 생성 결과 뒤에 이 파일이 바뀌었습니다.",
  unowned: "앱이 수용한 기록이 없어 생성기가 만든 파일이라고 단정하지 않습니다(직접 실행·구버전 출력·직접 만든 파일).",
  foreign: "다른 프로젝트(이름 변경·복사 포함)나 다른 페이지의 기록입니다. 이 프로젝트의 출력으로 보지 않습니다.",
};

function DiffView({ before, after }: { before: string; after: string }) {
  const diff = diffLines(before, after);
  if (diff.added === 0 && diff.removed === 0) {
    return <p className="text-xs text-content-muted">줄 내용은 같고 바이트만 다릅니다(줄바꿈·BOM 등).</p>;
  }
  return (
    <div className="mt-1">
      <p className="text-xs text-content-muted">
        +{diff.added} / −{diff.removed}
        {diff.approximate && " · 변경이 커서 줄 맞춤 없이 보입니다"}
      </p>
      <pre className="mt-1 max-h-60 overflow-auto rounded-control border border-line bg-surface-inset p-2 text-[11px] leading-4">
        {diff.lines.map((line, index) => <DiffRow key={index} line={line} />)}
      </pre>
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  if (line.kind === "skip") return <div className="text-content-subtle">… 같은 줄 {line.count}개 …</div>;
  if (line.kind === "add") return <div className="bg-success-bg text-success">+ {line.text}</div>;
  if (line.kind === "remove") return <div className="bg-error-bg text-error">- {line.text}</div>;
  return <div className="text-content-muted">  {line.text}</div>;
}

function ReviewItem({
  item,
  decision,
  onDecide,
}: {
  item: OverwriteReviewItem;
  decision: OverwriteDecision;
  onDecide: (decision: OverwriteDecision) => void;
}) {
  const decide = needsDecision(item);
  return (
    <li className="rounded-panel border border-line bg-surface-raised p-2">
      <p className="truncate text-xs font-semibold text-content-strong">
        <code>generated/{item.path}</code>
      </p>
      <p className={`text-xs ${decide ? "text-error" : "text-content-muted"}`}>{OWNERSHIP_LABEL[item.ownership]}</p>
      {decide && (
        <>
          <p className="mt-1 text-xs text-content-muted">{OWNERSHIP_HINT[item.ownership]}</p>
          <fieldset className="mt-2 flex flex-col gap-1 text-xs text-content">
            <legend className="sr-only">{item.path} 처리</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`overwrite-${item.path}`}
                checked={decision === "keep"}
                onChange={() => onDecide("keep")}
              />
              보존 — 이 파일은 바꾸지 않습니다
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`overwrite-${item.path}`}
                checked={decision === "overwrite"}
                onChange={() => onDecide("overwrite")}
              />
              백업 후 덮어쓰기
            </label>
          </fieldset>
          {item.baselineText !== null && item.currentText !== null && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-content">수동 변경 (마지막 생성 → 지금 파일)</summary>
              <DiffView before={item.baselineText} after={item.currentText} />
            </details>
          )}
          {item.currentText !== null && (
            <details className="mt-1 text-xs" open={item.baselineText === null}>
              <summary className="cursor-pointer text-content">덮어쓰면 바뀌는 내용 (지금 파일 → 새 출력)</summary>
              <DiffView before={item.currentText} after={item.nextText} />
            </details>
          )}
        </>
      )}
    </li>
  );
}

/**
 * 쓰기 전 확인 화면(#282). 이번 응답이 건드리는 파일 전부(영향 목록)를 보이고, 사람이 고쳤거나
 * 누구 것인지 모르는 파일마다 보존/백업 후 덮어쓰기를 고르게 한다. 고르지 않으면 보존이다.
 *
 * "전체 취소"는 아무 파일도 쓰지 않는다. "선택대로 적용"도 적용 직전에 확인 당시 버전과 다시
 * 비교해, 그 사이 파일이 바뀌었으면 하나도 쓰지 않고 멈춘다(`ui/ticketOutputAcceptance.ts`).
 */
export function OverwriteReviewPanel({
  review,
  onAnswer,
}: {
  review: OverwriteReview;
  onAnswer: (answer: OverwriteAnswer) => void;
}) {
  const [decisions, setDecisions] = useState<Record<string, OverwriteDecision>>({});
  const conflicts = review.items.filter(needsDecision);
  const overwriteCount = conflicts.filter((item) => decisions[item.path] === "overwrite").length;
  const setAll = (decision: OverwriteDecision) =>
    setDecisions(Object.fromEntries(conflicts.map((item) => [item.path, decision])));

  return (
    <section aria-label="덮어쓰기 전 확인" className="flex max-h-[60vh] flex-col gap-2 overflow-auto">
      <p className="text-xs font-semibold text-content-strong">
        덮어쓰기 전 확인 — 확인이 필요한 파일 {conflicts.length}개
      </p>
      <p className="text-xs text-content-muted">
        에이전트 응답을 받았지만 아직 generated/의 파일은 하나도 바꾸지 않았습니다. 바꿀 기존 파일은 먼저
        백업하고, 적용 직전에 다시 비교해 그 사이 바뀐 파일이 있으면 멈춥니다.
      </p>
      <div className="flex gap-2 text-xs">
        <button type="button" onClick={() => setAll("keep")} className="underline hover:text-content">
          모두 보존
        </button>
        <button type="button" onClick={() => setAll("overwrite")} className="underline hover:text-content">
          모두 백업 후 덮어쓰기
        </button>
      </div>
      <ol className="flex flex-col gap-2">
        {review.items.map((item) => (
          <ReviewItem
            key={item.path}
            item={item}
            decision={decisions[item.path] ?? "keep"}
            onDecide={(decision) => setDecisions((previous) => ({ ...previous, [item.path]: decision }))}
          />
        ))}
      </ol>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAnswer(decisions)}
          className="rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-hover"
        >
          선택대로 적용 (덮어쓰기 {overwriteCount}개)
        </button>
        <button
          type="button"
          onClick={() => onAnswer("cancel")}
          className="rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-hover"
        >
          전체 취소
        </button>
      </div>
    </section>
  );
}

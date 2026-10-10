import { beginDocumentTransition } from "./documentTransition";
import { useMemo, useRef, useState } from "react";
import {
  listUnnamedDrafts, removeAllUnnamedDrafts, summarizeUnnamedDraft, useUnnamedDraftStore,
  type BulkRemovalPlan, type BulkRemovalResult, type DraftResult, type ListedUnnamedDraft, type UnnamedDraft,
} from "@/features/editor/store/unnamedDraftStore";
import { promptConfirm } from "@/features/editor/store/promptDialogStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";

const messages: Record<Exclude<DraftResult, "ok">, string> = {
  busy: "다른 탭에서 사용 중인 초안입니다. 그 탭에서 다른 문서를 열거나 탭을 닫은 뒤 다시 시도하세요.",
  changed: "초안이나 현재 문서가 변경되었습니다. 내용을 확인한 뒤 다시 시도하세요.",
  unavailable: "브라우저 초안 저장소를 사용할 수 없습니다. 현재 작업은 유지됩니다.",
  cancelled: "현재 작업을 유지했습니다.",
};
const savedAtFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });
const EXCLUDED = "이 탭의 초안·다른 탭에서 사용 중";
function bulkMessage({ removed, skipped, failed, excluded }: BulkRemovalResult): string {
  if (!removed && !skipped && !failed) return `삭제할 수 있는 초안이 없습니다. 제외 ${excluded}개(${EXCLUDED}).`;
  return `초안 ${removed}개를 삭제했습니다. 건너뜀 ${skipped}개(사용 중이거나 변경됨), 실패 ${failed}개, 제외 ${excluded}개(${EXCLUDED}).`;
}
function DraftDetails({ draft }: { draft: ListedUnnamedDraft }) {
  const { pages, firstPage, width, height, layers } = summarizeUnnamedDraft(draft.document.spec);
  return (
    <p className="text-xs text-content-muted">
      {draft.savedAt === null ? "시각 정보 없음" : <>마지막 보관 <time dateTime={new Date(draft.savedAt).toISOString()}>{savedAtFormat.format(draft.savedAt)}</time></>}
      {` · 페이지 ${pages}개 · 첫 페이지 ${firstPage} ${width}×${height} · 레이어 ${layers}개`}
    </p>
  );
}

/** Separate from disk project cards and from the named-file conflict discard action. */
export function UnnamedDrafts() {
  const revision = useUnnamedDraftStore(s => s.revision);
  const active = useUnnamedDraftStore(s => s.active);
  const drafts = useMemo(() => {
    const stored = listUnnamedDrafts();
    // 이 탭의 초안은 맨 위, 나머지는 listUnnamedDrafts의 최근 보관순이다(#351).
    const entries = active ? [active, ...stored.filter(draft => draft.key !== active.key)] : stored;
    return entries.map(draft => {
      const saved = stored.find(item => item.key === draft.key && item.raw === draft.raw);
      return { ...draft, persisted: saved !== undefined, savedAt: saved?.savedAt ?? null };
    });
  }, [revision, active]);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function act(draft: UnnamedDraft, deleting: boolean) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage(null);
    const transition = beginDocumentTransition();
    try {
      if (deleting && !await promptConfirm({
        title: "이름 없는 초안 삭제",
        message: `${draft.document.spec.name} · ${draft.key.split(":").pop()}\n이 브라우저에 보관한 초안을 삭제합니다. 디스크 파일은 삭제하지 않습니다. 되돌릴 수 없습니다.`,
        confirmLabel: "초안 삭제", signal: new AbortController().signal,
      })) return;
      if (!transition.current()) { setMessage(messages.changed); return; }
      const result = await useUnnamedDraftStore.getState()[deleting ? "remove" : "resume"](draft);
      if (result !== "ok") setMessage(messages[result]);
      else if (!deleting) useNavigationStore.getState().openEditor();
    } finally { busy.current = false; setPending(false); }
  }
  async function removeAll() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage(null);
    const transition = beginDocumentTransition();
    const confirm = async ({ targets, excluded }: BulkRemovalPlan) => transition.current() && await promptConfirm({
      title: "이름 없는 초안 모두 삭제",
      message: `보관한 이름 없는 초안 ${targets.length}개를 삭제합니다. 제외 ${excluded}개(${EXCLUDED}).\n디스크 파일은 삭제하지 않습니다. 되돌릴 수 없습니다.`,
      confirmLabel: `초안 ${targets.length}개 삭제`, signal: new AbortController().signal,
    }) && transition.current();
    try {
      const result = await removeAllUnnamedDrafts(confirm, transition);
      if (result) setMessage(bulkMessage(result));
      else if (!transition.current()) setMessage(messages.changed);
    } finally { busy.current = false; setPending(false); }
  }
  if (!drafts.length && !message) return null;
  return (
    <section aria-label="보관한 초안" className="mb-6 w-full max-w-3xl rounded-panel border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-content-strong">보관한 이름 없는 초안</h2>
      <p className="my-2 text-xs text-content-muted">브라우저 초안이며 파일 저장과 다릅니다. 저장소 오류 시 이 탭을 닫지 마세요. 파일로 남기려면 이어서 열고 File → Save를 사용하세요.</p>
      {message && <p role="status" className="my-2 text-sm">{message}</p>}
      <ul className="flex flex-col gap-3">
        {drafts.map(draft => (
          <li key={draft.key} className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div><p>{draft.document.spec.name} · {active?.key === draft.key ? "이 탭의 초안" : "보관한 초안"} · 파일 저장 전</p>
              {!draft.persisted && <p className="text-xs text-content-muted">브라우저 보관 대기 — 이 탭을 닫지 마세요.</p>}
              {draft.persisted && <DraftDetails draft={draft} />}
              <p className="text-xs text-content-muted">초안 {draft.key.split(":").pop()}</p></div>
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => void act(draft, false)} className="rounded-control border border-line px-3 py-1 hover:bg-hover disabled:opacity-50">이어서 열기</button>
              <button type="button" disabled={pending} onClick={() => void act(draft, true)} className="rounded-control border border-line px-3 py-1 hover:bg-hover disabled:opacity-50">삭제…</button>
            </div>
          </li>
        ))}
      </ul>
      {drafts.length > 1 && (
        <div className="mt-3 flex justify-end">
          <button type="button" disabled={pending} onClick={() => void removeAll()} className="rounded-control border border-line px-3 py-1 text-sm hover:bg-hover disabled:opacity-50">모두 삭제…</button>
        </div>
      )}
    </section>
  );
}

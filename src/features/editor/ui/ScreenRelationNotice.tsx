import { useMemo } from "react";
import { isScreenRelationIssue, validateProjectSpec } from "@/features/editor/schema";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { RELATION_RECOVERY_GUIDANCE } from "@/features/editor/store/validationGuidance";
import { downloadTextFile } from "./exportSpecAsJson";

/** 복원 직후에도 표시하며 Undo/문서 전환/수정 시 현재 spec에서 다시 계산한다. */
export function ScreenRelationNotice() {
  const spec = useEditorStore(s => s.spec);
  const issues = useMemo(() => validateProjectSpec(spec).issues.filter(isScreenRelationIssue), [spec]);
  if (issues.length === 0) return null;
  return (
    <section aria-label="화면 관계 오류" className="[grid-area:notice] max-h-48 overflow-auto border-b border-line bg-surface p-3 text-sm">
      <p role="alert" className="font-semibold">화면 관계 오류 {issues.length}건 — 현재 작업은 열려 있지만 저장할 수 없습니다.</p>
      <ul className="my-2 break-words">
        {issues.map((issue, index) => <li key={index}><code>[{issue.code}] {issue.path}</code>: {issue.message}</li>)}
      </ul>
      <p>{RELATION_RECOVERY_GUIDANCE}</p>
      <p className="my-2">이 사본은 오류가 포함된 현재 프로젝트 JSON입니다. 정상 저장·생성 결과가 아니며, 수정 전에는 열기가 거부됩니다. 다운로드는 원본 파일·브라우저 초안·저장 상태를 바꾸지 않습니다.</p>
      <button type="button" className="rounded-control border border-line px-3 py-1 hover:bg-hover"
        onClick={() => downloadTextFile(`unvalidated-recovery-${crypto.randomUUID()}.json`, JSON.stringify(spec, null, 2))}>
        미검증 복구 사본 다운로드
      </button>
    </section>
  );
}

import { useState } from "react";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useResponsiveViewStore } from "@/features/editor/responsive/responsiveViewStore";
import { basePreviewWidth } from "@/features/editor/responsive/resolveResponsive";
import type { ProjectSpec } from "@/features/editor/schema";
import { PropertySection } from "./PropertySection";
import { SelectField, type SelectOption } from "./fields";
import { interactionCommand, interactionTargets, interactionWarning, type InteractionChoice } from "./interactionPatch";

export function InteractionSection({ responsive }: { responsive: boolean }) {
  const spec = useEditorStore((state) => state.spec);
  const pageId = useEditorStore((state) => state.activePageId);
  const selectedId = useEditorStore((state) => state.selectedId);
  const [draft, setDraft] = useState<{ spec: ProjectSpec; choice: InteractionChoice } | null>(null);
  const [error, setError] = useState<{ spec: ProjectSpec; message: string } | null>(null);
  const page = spec.pages[pageId];
  const node = selectedId === null ? undefined : page.nodes[selectedId];
  if (node?.type !== "button" || selectedId === null) return null;
  const action = node.action;
  const choice = draft?.spec === spec ? draft.choice : action?.type ?? "none";
  const options: SelectOption<InteractionChoice>[] = [
    { value: "none", label: "없음" }, { value: "navigate", label: "페이지 이동" }, { value: "openModal", label: "모달 열기" },
  ];
  if ((page.kind ?? "page") !== "page" || action?.type === "close") options.push({ value: "close", label: "닫기" });
  const targets = interactionTargets(spec, choice);
  const currentTarget = action?.type === choice && "target" in action ? action.target : "";
  const missing = currentTarget !== "" && !targets.some((option) => option.value === currentTarget);
  const warning = interactionWarning(spec, pageId, selectedId);

  function commit(next: InteractionChoice, target?: string) {
    if (responsive) return;
    const command = interactionCommand(selectedId!, next, target);
    if (!command) return;
    if (command.type === "removeNodeAction" && action === undefined) {
      setError(null); setDraft(null); return;
    }
    const editor = useEditorStore.getState();
    if (command.type === "removeNodeAction") {
      if (action !== undefined) editor.removeNodeAction(command.id);
    } else if (command.type === "updateNode") editor.setNodeField(command.id, command.path, command.value);
    const message = useResponsiveViewStore.getState().error;
    setError(useEditorStore.getState().spec === spec && message ? { spec, message } : null);
    setDraft(null);
  }

  return <PropertySection title="Interaction">
    {responsive ? <div className="flex flex-col gap-2">
      <p className="text-xs text-content-muted">버튼 동작은 모든 화면 폭에 공통입니다. 기본값(base) 편집으로 전환해 설정하세요.</p>
      <button type="button" className="self-start rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-surface-muted"
        onClick={() => useResponsiveViewStore.getState().setWidth(pageId, basePreviewWidth(page))}>기본값으로 전환</button>
    </div> : <>
      <SelectField label="동작" value={choice} options={options} onChange={(next) => {
        setError(null);
        if (next === "none" || next === "close") commit(next);
        else setDraft({ spec, choice: next });
      }} />
      {(choice === "navigate" || choice === "openModal") && <>
        <SelectField label="대상 화면" value={currentTarget} options={[
          { value: "", label: targets.length ? "대상을 선택하세요" : "연결할 화면이 없습니다" },
          ...(missing ? [{ value: currentTarget, label: `사용할 수 없는 대상 (${currentTarget})` }] : []), ...targets,
        ]} onChange={(target) => { if (target) commit(choice, target); }} />
        {currentTarget === "" && <p className="text-xs text-content-muted">대상을 선택하면 연결을 저장합니다. 선택 전에는 기존 연결을 유지합니다.</p>}
      </>}
    </>}
    {warning && <p role="alert" className="text-xs text-content-muted">{warning}</p>}
    {error?.spec === spec && <p role="alert" className="text-xs text-content-muted">{error.message}</p>}
  </PropertySection>;
}

import { useMemo, useState } from "react";

import { useEditorStore } from "@/features/editor/store/editorStore";
import type { Color, Node, Typography } from "@/features/editor/schema";
import { PropertySection } from "./PropertySection";
import { ColorField, SelectField, TextField } from "./fields";

function colorTargets(node: Node): { target: string; label: string; value: Color }[] {
  const result: { target: string; label: string; value: Color }[] = [];
  if ("color" in node) result.push({ target: "color", label: "글자색", value: node.color });
  if ("border" in node && node.border) result.push({ target: "border.color", label: "테두리색", value: node.border.color });
  if (node.type === "frame" && node.shadow) result.push({ target: "shadow.color", label: "그림자색", value: node.shadow.color });
  for (const [fillIndex, fill] of ("background" in node ? node.background ?? [] : []).entries()) {
    if (fill.type === "solid") result.push({ target: `background.${fillIndex}.color`, label: `배경 ${fillIndex + 1}`, value: fill.color });
    if (fill.type === "linear") for (const [stopIndex, stop] of fill.stops.entries()) {
      result.push({ target: `background.${fillIndex}.stops.${stopIndex}.color`, label: `배경 ${fillIndex + 1} stop ${stopIndex + 1}`, value: stop.color });
    }
  }
  return result;
}

function typographyOf(node: Node): Typography | undefined {
  return "typography" in node ? node.typography : undefined;
}

export function DesignStylesSection() {
  const spec = useEditorStore((state) => state.spec);
  const pageId = useEditorStore((state) => state.activePageId);
  const selectedId = useEditorStore((state) => state.selectedId);
  const createColorStyle = useEditorStore((state) => state.createColorStyle);
  const applyColorStyle = useEditorStore((state) => state.applyColorStyle);
  const updateColorStyle = useEditorStore((state) => state.updateColorStyle);
  const deleteColorStyle = useEditorStore((state) => state.deleteColorStyle);
  const createTypographyStyle = useEditorStore((state) => state.createTypographyStyle);
  const applyTypographyStyle = useEditorStore((state) => state.applyTypographyStyle);
  const updateTypographyStyle = useEditorStore((state) => state.updateTypographyStyle);
  const deleteTypographyStyle = useEditorStore((state) => state.deleteTypographyStyle);
  const [colorName, setColorName] = useState("");
  const [typographyName, setTypographyName] = useState("");
  const [colorNameDrafts, setColorNameDrafts] = useState<Record<string, string>>({});
  const [typographyNameDrafts, setTypographyNameDrafts] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const node = selectedId ? spec.pages[pageId]?.nodes[selectedId] : undefined;
  const targets = useMemo(() => node ? colorTargets(node) : [], [node]);
  const colorStyles = Object.entries(spec.styles?.colors ?? {});
  const typographyStyles = Object.entries(spec.styles?.typography ?? {});
  const currentTypography = node ? typographyOf(node) : undefined;

  function report(ok: boolean) {
    setError(ok ? "" : "스타일 변경을 적용하지 못했습니다. 이름과 값을 확인하세요.");
  }

  function clearChoice(target: string) {
    setChosen((current) => {
      const next = { ...current };
      delete next[target];
      return next;
    });
  }

  return (
    <PropertySection title="공용 스타일 (Design System)" defaultOpen={false}>
      {targets.map(({ target, label, value }) => (
        <div key={target} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <SelectField label={`${label} 스타일`} value={chosen[target] ?? (node && "styleRefs" in node ? node.styleRefs?.colors?.[target] : undefined)} placeholder="연결 없음 · 스타일 선택"
              options={colorStyles.map(([id, style]) => ({ value: id, label: style.name }))}
              onChange={(id) => { if (id) setChosen((current) => ({ ...current, [target]: id })); else clearChoice(target); }} />
            <p className="text-xs text-content-muted">현재 연결: {colorStyles.find(([id]) => id === (node && "styleRefs" in node ? node.styleRefs?.colors?.[target] : undefined))?.[1].name ?? "없음"}</p>
          </div>
          <button type="button" className="rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-surface-muted"
            disabled={!chosen[target] || chosen[target] === (node && "styleRefs" in node ? node.styleRefs?.colors?.[target] : undefined)} onClick={() => { const result = applyColorStyle(chosen[target]!, pageId, selectedId!, target); report(result.ok); if (result.ok) clearChoice(target); }}>적용</button>
          <button type="button" className="rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-surface-muted"
            onClick={() => { const id = createColorStyle(colorName.trim() || `${label} ${colorStyles.length + 1}`, value, pageId, selectedId!, target); report(id !== null); if (id) { setColorName(""); clearChoice(target); } }}>저장</button>
        </div>
      ))}
      {targets.length > 0 ? <TextField label="새 색 스타일 이름" value={colorName} onChange={setColorName} placeholder="예: Brand Primary" /> : null}
      {colorStyles.map(([id, style]) => (
        <div key={id} className="rounded-control border border-line p-2">
          <TextField label="표시 이름" value={colorNameDrafts[id] ?? style.name} onChange={(name) => setColorNameDrafts((current) => ({ ...current, [id]: name }))} />
          <button type="button" className="text-xs text-content-muted underline" onClick={() => { const name = (colorNameDrafts[id] ?? style.name).trim(); if (name) { report(updateColorStyle(id, name, style.value).ok); setColorNameDrafts((current) => { const next = { ...current }; delete next[id]; return next; }); } }}>이름 변경</button>
          <ColorField label="색상" value={style.value} onChange={(value) => report(updateColorStyle(id, style.name, value).ok)} />
          <button type="button" className="text-xs text-content-muted underline" onClick={() => report(deleteColorStyle(id).ok)}>스타일 삭제 · 연결 해제</button>
        </div>
      ))}

      {currentTypography ? <>
        <TextField label="새 글자 스타일 이름" value={typographyName} onChange={setTypographyName} placeholder="예: Heading Large" />
        <button type="button" className="rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-surface-muted"
          onClick={() => { const id = createTypographyStyle(typographyName.trim() || `글자 ${typographyStyles.length + 1}`, currentTypography, pageId, selectedId!); report(id !== null); if (id) setTypographyName(""); }}>현재 글자값 저장·연결</button>
      </> : null}
      {typographyStyles.map(([id, style]) => (
        <div key={id} className="rounded-control border border-line p-2">
          <TextField label="표시 이름" value={typographyNameDrafts[id] ?? style.name} onChange={(name) => setTypographyNameDrafts((current) => ({ ...current, [id]: name }))} />
          <button type="button" className="text-xs text-content-muted underline" onClick={() => { const name = (typographyNameDrafts[id] ?? style.name).trim(); if (name) { report(updateTypographyStyle(id, name, style.value).ok); setTypographyNameDrafts((current) => { const next = { ...current }; delete next[id]; return next; }); } }}>이름 변경</button>
          {currentTypography ? <button type="button" className="rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-surface-muted"
            onClick={() => report(updateTypographyStyle(id, style.name, currentTypography).ok)}>선택 노드의 6개 글자값으로 연결 전체 업데이트</button> : null}
          <button type="button" className="rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-surface-muted"
            onClick={() => report(applyTypographyStyle(id, pageId, selectedId!,).ok)}>선택 노드에 적용</button>
          <button type="button" className="text-xs text-content-muted underline" onClick={() => report(deleteTypographyStyle(id).ok)}>스타일 삭제 · 연결 해제</button>
        </div>
      ))}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </PropertySection>
  );
}

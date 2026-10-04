import { useState } from "react";
import { useEditorStore } from "@/features/editor/store/editorStore";
import type { NodeOverride, Responsive } from "@/features/editor/schema";
import { emptyResponsive, overridePaths, removeResponsiveOverride, sortedBreakpoints } from "./resolveResponsive";
import { useResponsiveScreen } from "./useResponsiveScreen";
import { useResponsiveViewStore } from "./responsiveViewStore";

const inputClass = "min-w-0 rounded-control border border-line bg-surface-inset px-2 py-1 text-xs text-content";
const buttonClass = "rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-surface-raised";
export function ResponsivePanel() {
  const { pageId, screen, resolved, width, breakpoint } = useResponsiveScreen();
  const selectedId = useEditorStore((state) => state.selectedId);
  const error = useResponsiveViewStore((state) => state.error);
  const setWidth = useResponsiveViewStore((state) => state.setWidth);
  const [newId, setNewId] = useState("");
  const [newWidth, setNewWidth] = useState("768");
  const responsive = screen.responsive ?? emptyResponsive();
  const points = sortedBreakpoints(screen);
  const pointOverrides = breakpoint && Object.prototype.hasOwnProperty.call(responsive.overrides, breakpoint) ? responsive.overrides[breakpoint] : {};
  const own = selectedId && Object.prototype.hasOwnProperty.call(pointOverrides, selectedId) ? pointOverrides[selectedId] : undefined;
  const paths = overridePaths(own ?? {}).filter(Boolean);
  function save(next: Responsive) {
    const message = useEditorStore.getState().setResponsive(pageId, next);
    useResponsiveViewStore.getState().reportError(message);
    return !message;
  }
  function add() {
    const px = Number(newWidth);
    if (!/^[A-Za-z0-9_-]+$/.test(newId) || Object.prototype.hasOwnProperty.call(responsive.breakpoints, newId) || !Number.isFinite(px) || px <= 0) {
      useResponsiveViewStore.getState().reportError("새 ID는 영문·숫자·밑줄·하이픈이며 중복될 수 없습니다. 폭은 양수여야 합니다."); return;
    }
    if (save({ ...responsive, breakpoints: { ...responsive.breakpoints, [newId]: { minWidthPx: px } } })) {
      setWidth(pageId, px); setNewId("");
    }
  }
  function removeBreakpoint() {
    if (!breakpoint) return;
    const breakpoints = { ...responsive.breakpoints }; const overrides = { ...responsive.overrides };
    delete breakpoints[breakpoint]; delete overrides[breakpoint];
    save({ breakpoints, overrides });
  }
  function pin() {
    if (!selectedId || !breakpoint) return;
    const node = resolved.nodes[selectedId];
    const allowed = new Set(["box", "layout", "background", "border", "typography", "color", "opacity", "blur", "visible", "fit"]);
    const patch = Object.fromEntries(Object.entries(node).filter(([key]) => allowed.has(key))) as NodeOverride;
    save({ ...responsive, overrides: { ...responsive.overrides, [breakpoint]: { ...pointOverrides, [selectedId]: patch } } });
  }
  return <section className="flex flex-col gap-2 border-b border-line p-3" aria-label="반응형 편집">
    <h3 className="text-xs font-semibold text-content">반응형</h3>
    <label className="flex items-center justify-between gap-2 text-xs text-content-muted">편집 기준
      <select aria-label="반응형 편집 기준" className={inputClass} value={breakpoint ?? ""} onChange={(event) => {
        const id = event.target.value;
        setWidth(pageId, id ? responsive.breakpoints[id].minWidthPx : Math.min(screen.size.width, (points[0]?.[1].minWidthPx ?? screen.size.width * 2) / 2));
      }}>
        <option value="">기본값 (상속 시작)</option>
        {points.map(([id, point]) => <option key={id} value={id}>{id} · ≥{point.minWidthPx}px</option>)}
      </select>
    </label>
    <label className="flex items-center justify-between gap-2 text-xs text-content-muted">미리보기 폭 (px)
      <input aria-label="미리보기 폭" className={`${inputClass} w-24`} type="number" min="0.01" step="any" value={width} onChange={(event) => setWidth(pageId, Number(event.target.value))} />
    </label>
    <p className="text-2xs text-content-subtle">폭은 문서 크기와 별개입니다. {breakpoint ? `${breakpoint} 이상에서 적용할 값 편집` : "모든 폭의 기반 값 편집"}. 더 큰 폭은 아래 폭의 값을 상속합니다.</p>
    <div className="flex gap-1">
      <input aria-label="새 breakpoint ID" placeholder="새 ID" className={`${inputClass} flex-1`} value={newId} onChange={(event) => setNewId(event.target.value)} />
      <input aria-label="새 breakpoint 최소 폭" type="number" min="0.01" step="any" className={`${inputClass} w-20`} value={newWidth} onChange={(event) => setNewWidth(event.target.value)} />
      <button type="button" className={buttonClass} onClick={add}>추가</button>
    </div>
    {breakpoint && <div className="flex items-center gap-2">
      <label className="text-2xs text-content-muted">경계 px <input key={`${pageId}:${breakpoint}:${responsive.breakpoints[breakpoint].minWidthPx}`} aria-label="breakpoint 최소 폭" type="number" min="0.01" step="any" className={`${inputClass} w-20`} defaultValue={responsive.breakpoints[breakpoint].minWidthPx} onBlur={(event) => {
        const px = Number(event.target.value);
        if (save({ ...responsive, breakpoints: { ...responsive.breakpoints, [breakpoint]: { minWidthPx: px } } })) setWidth(pageId, px);
      }} /></label>
      <button type="button" className={buttonClass} onClick={removeBreakpoint}>breakpoint 삭제</button>
    </div>}
    {breakpoint && selectedId && <div className="flex flex-col gap-1" aria-label="상속과 override">
      <p className="text-2xs text-content-muted">{paths.length ? "이 폭에서 덮어쓴 속성:" : "모든 표현 속성: 상속"} 목록 밖의 속성은 상속됩니다.</p>
      {paths.map((path) => <div key={path} className="flex items-center justify-between gap-1 text-2xs text-content">
        <span>{path} · override</span><button type="button" className={buttonClass} aria-label={`${path} override 해제`} onClick={() => save(removeResponsiveOverride(responsive, breakpoint, selectedId, path))}>상속</button>
      </div>)}
      <div className="flex gap-1">
        <button type="button" className={buttonClass} onClick={pin}>현재 표현값 고정</button>
        <button type="button" className={buttonClass} disabled={!paths.length} onClick={() => save(removeResponsiveOverride(responsive, breakpoint, selectedId))}>이 노드 override 삭제</button>
      </div>
      <p className="text-2xs text-content-subtle">이름·내용·트리·그림자는 기본값에서 편집합니다. 캔버스 크기 변경은 아래 속성 패널을 사용하세요. 복제는 반응형 값을 보존하고 복사·붙여넣기는 기존 기본값만 옮깁니다.</p>
    </div>}
    {error && <p role="alert" className="whitespace-pre-wrap text-2xs text-error">{error}</p>}
  </section>;
}

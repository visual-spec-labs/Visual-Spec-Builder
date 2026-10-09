import { useId, useState } from "react";
import { useEditorStore } from "@/features/editor/store/editorStore";
import type { Responsive } from "@/features/editor/schema";
import { emptyResponsive, pinnedAppearance, resolveResponsiveScreen, overridePaths, removeResponsiveOverride, sortedBreakpoints } from "./resolveResponsive";
import { useResponsiveScreen } from "./useResponsiveScreen";
import { useResponsiveViewStore } from "./responsiveViewStore";

const inputClass = "min-w-0 rounded-control border border-line bg-surface-inset px-2 py-1 text-xs text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-content";
const buttonClass = "rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-content disabled:cursor-not-allowed disabled:text-content-subtle";
export function ResponsivePanel() {
  const helpId = useId();
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
  const inherited = breakpoint ? resolveResponsiveScreen({ ...screen, responsive: removeResponsiveOverride(responsive, breakpoint, selectedId ?? "") }, responsive.breakpoints[breakpoint].minWidthPx).nodes[selectedId ?? ""] : undefined;
  const paths = overridePaths(own ?? {}, "", inherited).filter(Boolean);
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
    const patch = pinnedAppearance(node);
    save({ ...responsive, overrides: { ...responsive.overrides, [breakpoint]: { ...pointOverrides, [selectedId]: patch } } });
  }
  return <section className="flex flex-col gap-2 border-b border-line p-3" aria-label="반응형 편집">
    <h3 className="text-xs font-semibold text-content">반응형 · 분기점(breakpoint)</h3>
    <label className="flex items-center justify-between gap-2 text-xs text-content-muted">편집 기준
      <select aria-label="반응형 편집 기준" aria-describedby={helpId} className={inputClass} value={breakpoint ?? ""} onChange={(event) => {
        const id = event.target.value;
        setWidth(pageId, id ? responsive.breakpoints[id].minWidthPx : Math.min(screen.size.width, (points[0]?.[1].minWidthPx ?? screen.size.width * 2) / 2));
      }}>
        <option value="">기본값 (base)</option>
        {points.map(([id, point]) => <option key={id} value={id}>{id} · ≥{point.minWidthPx}px</option>)}
      </select>
    </label>
    <label className="flex items-center justify-between gap-2 text-xs text-content-muted">미리보기 폭 (px)
      <input aria-label="미리보기 폭" aria-describedby={helpId} className={`${inputClass} w-24`} type="number" min="0.01" step="any" value={width} onChange={(event) => setWidth(pageId, Number(event.target.value))} />
    </label>
    <p id={helpId} className="text-xs text-content-muted">미리보기 폭에 따라 편집 기준도 바뀝니다. 기준을 고르면 미리보기 폭도 바뀝니다.</p>
    <details className="text-xs text-content-muted">
      <summary className="cursor-pointer rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-content">편집 범위와 상속 안내</summary>
      <div className="mt-2 space-y-2">
      <p>미리보기 폭은 페이지 크기를 바꾸지 않으며 문서·실행 취소 이력에 저장되지 않습니다.</p>
      <p>{breakpoint ? `${breakpoint} · ${responsive.breakpoints[breakpoint].minWidthPx}px 이상에서 적용할 재정의(override)를 편집합니다.` : "모든 폭의 기반이 되는 기본값(base)을 편집합니다."} 더 큰 폭은 작은 폭의 값을 상속하며, 같은 속성의 재정의가 있으면 그 값을 사용합니다.</p>
      <p>페이지 이름·크기, 노드 이름·내용·그림자는 기본값에서 편집합니다. 페이지 속성은 선택을 해제하거나 루트 프레임을 선택하면 표시됩니다.</p>
      </div>
    </details>
    <div className="flex flex-wrap gap-1">
      <input aria-label="새 분기점 ID" placeholder="분기점 ID" className={`${inputClass} flex-1`} value={newId} onChange={(event) => setNewId(event.target.value)} />
      <input aria-label="새 분기점 최소 폭" type="number" min="0.01" step="any" className={`${inputClass} w-20`} value={newWidth} onChange={(event) => setNewWidth(event.target.value)} />
      <button type="button" className={buttonClass} onClick={add}>추가</button>
    </div>
    {breakpoint && <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs text-content-muted">최소 폭(px) <input key={`${pageId}:${breakpoint}:${responsive.breakpoints[breakpoint].minWidthPx}`} aria-label="분기점 최소 폭" type="number" min="0.01" step="any" className={`${inputClass} w-20`} defaultValue={responsive.breakpoints[breakpoint].minWidthPx} onBlur={(event) => {
        const px = Number(event.target.value);
        if (save({ ...responsive, breakpoints: { ...responsive.breakpoints, [breakpoint]: { minWidthPx: px } } })) setWidth(pageId, px);
      }} /></label>
      <button type="button" className={buttonClass} onClick={removeBreakpoint} title="이 분기점과 포함된 모든 노드의 재정의를 삭제합니다.">분기점 삭제</button>
    </div>}
    {breakpoint && selectedId && <div className="flex flex-col gap-1" aria-label="상속과 재정의">
      <p className="text-xs text-content-muted">{paths.length ? "선택한 노드의 이 분기점 재정의:" : "선택한 노드의 모든 표현 속성: 상속"} 목록 밖의 속성은 상속됩니다.</p>
      {paths.map((path) => <div key={path} className="flex items-center justify-between gap-1 text-xs text-content">
        <span className="min-w-0 break-all">{path} · 재정의</span><button type="button" className={buttonClass} aria-label={`${path} 재정의 해제`} title="이 속성의 재정의를 지우고 기본값 또는 더 작은 분기점의 값을 상속합니다." onClick={() => save(removeResponsiveOverride(responsive, breakpoint, selectedId, path))}>상속</button>
      </div>)}
      <div className="flex flex-wrap gap-1">
        <button type="button" className={buttonClass} onClick={pin} title="선택한 노드의 현재 표현 속성을 이 분기점의 재정의로 저장합니다.">현재 표현값 고정</button>
        <button type="button" className={buttonClass} disabled={!paths.length} onClick={() => save(removeResponsiveOverride(responsive, breakpoint, selectedId))} title="이 분기점에서 선택한 노드의 모든 재정의를 지우고 상속합니다.">노드 재정의 삭제</button>
      </div>
      <p className="text-xs text-content-muted">복제는 반응형 값을 보존하고, 복사·붙여넣기는 기본값만 옮깁니다.</p>
    </div>}
    {error && <p role="alert" className="whitespace-pre-wrap border-l-2 border-error pl-2 text-xs text-content">오류: {error}</p>}
  </section>;
}

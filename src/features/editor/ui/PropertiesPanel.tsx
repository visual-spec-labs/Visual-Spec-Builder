/** 우측 세부설정 패널 — 선택 요소의 속성 편집. 지금은 자리만 잡는다. */
export function PropertiesPanel() {
  return (
    <aside className="overflow-auto border-l border-neutral-300 bg-white p-3 text-sm [grid-area:props]">
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        Properties
      </h2>
      <p className="text-neutral-400">세부설정 패널</p>
    </aside>
  );
}

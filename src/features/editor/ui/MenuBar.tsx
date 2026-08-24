/** 상단 메뉴바 — File / View (MVP). 지금은 자리만 잡는다. */
export function MenuBar() {
  return (
    <header className="flex items-center gap-4 border-b border-line bg-surface px-4 text-sm font-medium [grid-area:menu]">
      <span className="font-semibold text-content-strong">Visual Spec Builder</span>
      <span className="text-content-muted">File</span>
      <span className="text-content-muted">View</span>
    </header>
  );
}

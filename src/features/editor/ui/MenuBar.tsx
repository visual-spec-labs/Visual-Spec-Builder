/** 상단 메뉴바 — File / View (MVP). 지금은 자리만 잡는다. */
export function MenuBar() {
  return (
    <header className="flex items-center gap-4 border-b border-neutral-300 bg-white px-4 text-sm font-medium [grid-area:menu]">
      <span className="font-semibold text-neutral-900">Visual Spec Builder</span>
      <span className="text-neutral-500">File</span>
      <span className="text-neutral-500">View</span>
    </header>
  );
}

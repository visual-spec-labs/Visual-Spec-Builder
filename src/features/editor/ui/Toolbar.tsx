/** 하단 도구 모음 — Select / Frame / Text / Hand (MVP). 지금은 자리만 잡는다. */
export function Toolbar() {
  return (
    <footer className="flex items-center justify-center gap-2 border-t border-line bg-surface text-sm text-content-muted [grid-area:tool]">
      <span>Select</span>
      <span>·</span>
      <span>Frame</span>
      <span>·</span>
      <span>Text</span>
      <span>·</span>
      <span>Hand</span>
    </footer>
  );
}

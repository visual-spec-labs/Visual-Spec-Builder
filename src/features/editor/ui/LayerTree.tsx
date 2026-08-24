/** 좌측 레이어 트리 — 노드 계층 구조 탐색. 지금은 자리만 잡는다. */
export function LayerTree() {
  return (
    <aside className="overflow-auto border-r border-line bg-surface p-3 text-sm [grid-area:tree]">
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-content-muted uppercase">
        Layers
      </h2>
      <p className="text-content-subtle">레이어 트리</p>
    </aside>
  );
}

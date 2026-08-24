import { Plus } from "lucide-react";
import { useState } from "react";

/** 깊이별 들여쓰기 — Tailwind 스페이싱 스케일만 사용(임의값 금지). */
const INDENT_BY_DEPTH = ["pl-2", "pl-5", "pl-8", "pl-11", "pl-14"];

/** Figma 디자인 기준 정적 레이어 목록(표시 전용 콘텐츠). */
const LAYERS: { name: string; depth: number }[] = [
  { name: "DashboardPage", depth: 0 },
  { name: "Sidebar", depth: 1 },
  { name: "Logo", depth: 2 },
  { name: "Navigation", depth: 2 },
  { name: "UserProfile", depth: 2 },
  { name: "Main", depth: 1 },
  { name: "Header", depth: 2 },
  { name: "Content", depth: 2 },
  { name: "MetricGrid", depth: 3 },
  { name: "ProductTable", depth: 3 },
];

/**
 * 좌측 레이어 트리. 행 선택은 로컬 UI 상태(하이라이트)로만 처리한다
 * (스토어·데이터 연동 없음).
 */
export function LayerTree() {
  const [selected, setSelected] = useState("ProductTable");

  return (
    <aside className="flex flex-col overflow-hidden border-r border-line bg-surface [grid-area:tree]">
      <h2 className="px-3 pt-3 pb-2 text-xs font-semibold tracking-wide text-content-muted uppercase">
        Layers
      </h2>

      <ul className="flex-1 overflow-auto px-1 pb-2 text-sm">
        {LAYERS.map(({ name, depth }) => {
          const isSelected = selected === name;
          const indent =
            INDENT_BY_DEPTH[Math.min(depth, INDENT_BY_DEPTH.length - 1)];
          return (
            <li key={name}>
              <button
                type="button"
                onClick={() => setSelected(name)}
                aria-current={isSelected ? "true" : undefined}
                className={`flex w-full items-center rounded-control py-1 pr-2 ${indent} text-left ${
                  isSelected
                    ? "bg-primary-subtle text-primary"
                    : "text-content-muted hover:bg-hover hover:text-content"
                }`}
              >
                <span className="truncate">{name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center justify-between border-t border-line px-3 py-2">
        <button
          type="button"
          aria-label="레이어 추가"
          className="rounded-control p-0.5 text-content-muted hover:bg-hover hover:text-content"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
        <span className="font-mono text-xs text-content-subtle">10 layers</span>
      </footer>
    </aside>
  );
}

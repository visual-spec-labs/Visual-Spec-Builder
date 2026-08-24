import { ThemeToggle } from "@/features/editor/ui/ThemeToggle";

/** 상단 메뉴바 — Figma 디자인 기준 정적 레이아웃. 테마 토글은 기존 기능 유지. */
export function MenuBar() {
  return (
    <header className="flex items-center gap-4 border-b border-line bg-surface px-4 text-sm [grid-area:menu]">
      <div className="flex shrink-0 items-center gap-4">
        <span aria-hidden="true" className="size-4 rounded-sm bg-primary" />
        <span className="font-semibold text-content-strong">Visual Spec Builder</span>
        <span className="text-content-muted">File</span>
        <span className="text-content-muted">View</span>
      </div>

      <span className="min-w-0 flex-1 truncate text-center text-xs text-content-subtle">
        Untitled Project — DashboardPage.gui
      </span>

      <ThemeToggle />
    </header>
  );
}

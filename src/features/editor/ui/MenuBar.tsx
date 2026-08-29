import { useEffect, useRef, useState } from "react";

import { blankSpec } from "@/features/editor/store/blankSpec";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useViewStore } from "@/features/editor/store/viewStore";
import { ThemeToggle } from "@/features/editor/ui/ThemeToggle";
import { exportSpecAsJson, saveSpecAsJson } from "@/features/editor/ui/exportSpecAsJson";
import { openSpecFromFile } from "@/features/editor/ui/openSpecFromFile";

type MenuKey = "file" | "view";

type ActionEntry = { kind: "action"; label: string; onSelect: () => void };
type ToggleEntry = { kind: "toggle"; label: string; checked: boolean; onToggle: () => void };
type SeparatorEntry = { kind: "separator" };

type MenuEntry = ActionEntry | ToggleEntry | SeparatorEntry;

/** Import는 이번 범위 밖 — 클릭해도 메뉴만 닫히고 실제 동작은 없다. */
function noop() {
  /* 이후 이슈에서 연결 */
}

/**
 * spec을 렌더 시점 구독값이 아니라 클릭 시점에 getState()로 읽는다.
 * MenuBar가 s.spec을 구독하면 속성 패널에서 필드를 편집할 때마다
 * (가장 빈번한 리렌더) 매번 새 클로저가 생기고 재구독까지 하게 된다.
 * Export/Save/Save as는 클릭 때만 최신 spec이 필요하므로 반응형 구독이
 * 필요 없다.
 */
function handleExport() {
  exportSpecAsJson(useEditorStore.getState().spec);
}
function handleSaveAs() {
  saveSpecAsJson(useEditorStore.getState().spec);
}

/**
 * 상단 메뉴바 — Figma 디자인 기준 레이아웃(로고·브랜드·중앙 프로젝트명·테마 토글) +
 * File/View 드롭다운. Import는 이후 이슈에서 연결한다.
 * New는 loadSpec(blankSpec), Open은 openSpecFromFile(파일 선택 → 검증 →
 * loadSpec)로 연결돼 있다. Export/Save는 exportSpecAsJson(현재 파일명
 * 그대로 다운로드)을 공유하고, Save as는 파일명을 물어보는
 * saveSpecAsJson을 쓴다 — 워크스페이스가 없는 브라우저 앱이라 셋 다
 * 실질적으로 같은 "JSON 다운로드" 메커니즘이다.
 * 검증 실패 시 Export는 다운로드 대신 콘솔 경고만 남기고(메뉴 컨텍스트에
 * 인라인 에러 UI가 없어서 낸 절충), Open/Save as는 사용자 조작이
 * 원인이라 조용히 실패하면 원인을 알 수 없어 최소한의 alert로 알린다.
 * View 항목은 viewStore(줌·그리드·패널 표시)에 연결돼 있다.
 * Help은 gui-spec.md 기준 MVP 제외.
 */
export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  const loadSpec = useEditorStore((s) => s.loadSpec);
  const zoomIn = useViewStore((s) => s.zoomIn);
  const zoomOut = useViewStore((s) => s.zoomOut);
  const fitToScreen = useViewStore((s) => s.fitToScreen);
  const showGrid = useViewStore((s) => s.showGrid);
  const toggleGrid = useViewStore((s) => s.toggleGrid);
  const showPanels = useViewStore((s) => s.showPanels);
  const togglePanels = useViewStore((s) => s.togglePanels);

  const FILE_MENU: MenuEntry[] = [
    { kind: "action", label: "New", onSelect: () => loadSpec(blankSpec) },
    { kind: "action", label: "Open", onSelect: openSpecFromFile },
    { kind: "action", label: "Save", onSelect: handleExport },
    { kind: "action", label: "Save as", onSelect: handleSaveAs },
    { kind: "separator" },
    { kind: "action", label: "Import", onSelect: noop },
    { kind: "action", label: "Export", onSelect: handleExport },
  ];

  const VIEW_MENU: MenuEntry[] = [
    { kind: "action", label: "Zoom In", onSelect: zoomIn },
    { kind: "action", label: "Zoom Out", onSelect: zoomOut },
    { kind: "action", label: "Fit to Screen", onSelect: fitToScreen },
    { kind: "separator" },
    { kind: "toggle", label: "Show Grid", checked: showGrid, onToggle: toggleGrid },
    { kind: "toggle", label: "Panels/Sidebars", checked: showPanels, onToggle: togglePanels },
  ];

  useEffect(() => {
    if (!openMenu) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  return (
    <header
      ref={rootRef}
      className="flex items-center gap-4 border-b border-line bg-surface px-4 text-sm [grid-area:menu]"
    >
      <div className="flex shrink-0 items-center gap-4">
        <span aria-hidden="true" className="size-4 rounded-sm bg-primary" />
        <span className="font-semibold text-content-strong">Visual Spec Builder</span>
        <MenuButton
          label="File"
          isOpen={openMenu === "file"}
          onToggle={() => setOpenMenu((prev) => (prev === "file" ? null : "file"))}
          onCloseMenu={() => setOpenMenu(null)}
          entries={FILE_MENU}
        />
        <MenuButton
          label="View"
          isOpen={openMenu === "view"}
          onToggle={() => setOpenMenu((prev) => (prev === "view" ? null : "view"))}
          onCloseMenu={() => setOpenMenu(null)}
          entries={VIEW_MENU}
        />
      </div>

      <span className="min-w-0 flex-1 truncate text-center text-xs text-content-subtle">
        Untitled Project — DashboardPage.gui
      </span>

      <ThemeToggle />
    </header>
  );
}

function MenuButton({
  label,
  isOpen,
  onToggle,
  onCloseMenu,
  entries,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  onCloseMenu: () => void;
  entries: MenuEntry[];
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`rounded-control px-2 py-1 text-content-muted hover:bg-hover hover:text-content ${
          isOpen ? "bg-hover text-content-strong" : ""
        }`}
      >
        {label}
      </button>
      {isOpen && (
        <ul
          role="menu"
          className="absolute top-full left-0 z-10 mt-1 w-48 rounded-panel border border-line bg-surface py-1 shadow-popover"
        >
          {entries.map((entry, index) =>
            entry.kind === "separator" ? (
              <li key={`sep-${index}`} className="my-1 border-t border-line" />
            ) : (
              <li key={entry.label} role="menuitem">
                <button
                  type="button"
                  onClick={() => {
                    if (entry.kind === "action") {
                      entry.onSelect();
                      onCloseMenu();
                    } else {
                      entry.onToggle();
                    }
                  }}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-content hover:bg-hover"
                >
                  {entry.label}
                  {entry.kind === "toggle" && entry.checked && (
                    <span className="text-xs text-content-muted">✓</span>
                  )}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

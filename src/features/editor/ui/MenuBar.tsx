import { useEffect, useRef, useState } from "react";

import { useDocumentStore } from "@/features/editor/store/documentStore";
import { useEditorStore } from "@/features/editor/store/editorStore";
import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { useViewStore } from "@/features/editor/store/viewStore";
import { formatDocumentTitle } from "@/features/editor/ui/documentTitle";
import { ThemeToggle } from "@/features/editor/ui/ThemeToggle";
import { exportSpecAsJson, saveSpec, saveSpecAs } from "@/features/editor/ui/exportSpecAsJson";
import { importImageFromFile } from "@/features/editor/ui/importImageFromFile";
import { newSpec } from "@/features/editor/ui/newSpec";
import { openSpec } from "@/features/editor/ui/openSpecFromFile";

type MenuKey = "file" | "view";

type ActionEntry = { kind: "action"; label: string; onSelect: () => void };
type ToggleEntry = { kind: "toggle"; label: string; checked: boolean; onToggle: () => void };
type SeparatorEntry = { kind: "separator" };

type MenuEntry = ActionEntry | ToggleEntry | SeparatorEntry;

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
// 작업공간 쓰기는 비동기다(개발 서버 미들웨어로 PUT, 이슈 #133). 메뉴 항목은
// 반환값을 쓰지 않으므로 void로 떼어 버린다 — 결과 안내는 각 함수가 alert로 한다.
function handleSave() {
  void saveSpec(useEditorStore.getState().spec);
}
function handleSaveAs() {
  void saveSpecAs(useEditorStore.getState().spec);
}
function handleOpen() {
  void openSpec();
}

/**
 * 상단 메뉴바 — Figma 디자인 기준 레이아웃(로고·브랜드·중앙 프로젝트명·테마 토글) +
 * File/View 드롭다운.
 * New는 newSpec(빈 스펙 + 현재 문서 이름 비우기), Open은 openSpec(.visual-spec/specs/
 * 목록에서 고르기 → 검증 → loadSpec)로 연결돼 있다. Save/Save as는 작업공간
 * `.visual-spec/specs/`에 쓰고(이슈 #133), Save as만 파일명을 먼저 묻는다.
 * **Save의 대상은 지금 열려 있는 파일이다** — Open/Save as가 적어 둔
 * `documentStore.fileName`을 쓴다(PR #145 리뷰). Export는 그대로 브라우저
 * 다운로드다 — 스펙을 저장소 밖으로 꺼내는 경로는 남겨 둔다.
 * Import는 importImageFromFile(이미지 선택 → .visual-spec/assets/에 저장 → 선택된
 * 프레임/root에 삽입)로 연결돼 있다 — 코드·디자인 파일 가져오기는 이번 범위 밖(별도 이슈).
 * 검증 실패 시 Export는 다운로드 대신 콘솔 경고만 남기고(메뉴 컨텍스트에
 * 인라인 에러 UI가 없어서 낸 절충), Open/Save as는 사용자 조작이
 * 원인이라 조용히 실패하면 원인을 알 수 없어 최소한의 alert로 알린다.
 * View 항목은 viewStore(줌·그리드·패널 표시)에 연결돼 있다.
 * Help은 gui-spec.md 기준 MVP 제외.
 * 로고·브랜드명 클릭은 navigationStore.openHome()으로 홈 화면으로 돌아간다(#72) —
 * 홈 → 에디터는 카드 클릭/새 화면으로 들어오므로, 나가는 길도 있어야 한다.
 */
export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  // 제목에 필요한 작은 조각만 구독한다. spec 전체를 구독하면 속성 하나를 고칠
  // 때마다 메뉴바까지 다시 렌더되는 기존 주석의 문제가 되살아난다.
  const projectName = useEditorStore((s) => s.spec.name);
  const pageName = useEditorStore(
    (s) => s.spec.pages[s.activePageId]?.name ?? "페이지 없음",
  );
  const fileName = useDocumentStore((s) => s.fileName);
  const openHome = useNavigationStore((s) => s.openHome);
  const zoomIn = useViewStore((s) => s.zoomIn);
  const zoomOut = useViewStore((s) => s.zoomOut);
  const fitToScreen = useViewStore((s) => s.fitToScreen);
  const showGrid = useViewStore((s) => s.showGrid);
  const toggleGrid = useViewStore((s) => s.toggleGrid);
  const showPanels = useViewStore((s) => s.showPanels);
  const togglePanels = useViewStore((s) => s.togglePanels);

  const FILE_MENU: MenuEntry[] = [
    { kind: "action", label: "New", onSelect: newSpec },
    { kind: "action", label: "Open", onSelect: handleOpen },
    { kind: "action", label: "Save", onSelect: handleSave },
    { kind: "action", label: "Save as", onSelect: handleSaveAs },
    { kind: "separator" },
    { kind: "action", label: "Import", onSelect: importImageFromFile },
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
      if (event.key !== "Escape") return;
      // **여기서 삼킨다.** 캔버스도 window에서 Escape를 듣고 선택을 해제하는데
      // (canvasInput.viewCommandForKey), 막지 않으면 메뉴만 닫으려고 누른 Escape가
      // 선택과 속성 패널까지 함께 지운다.
      //
      // 이 리스너는 위의 `if (!openMenu) return`으로 **메뉴가 열려 있을 때만**
      // 붙으므로 조건을 더 볼 필요가 없다. document 리스너가 window 리스너보다
      // 먼저 도니까(이벤트가 target에서 window로 오르는 길에 document를 지난다)
      // 여기서 멈추면 캔버스에는 닿지 않는다.
      event.stopPropagation();
      setOpenMenu(null);
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
        <button
          type="button"
          onClick={openHome}
          className="flex items-center gap-2 rounded-control hover:bg-hover"
          aria-label="홈으로"
        >
          <span aria-hidden="true" className="size-4 rounded-sm bg-primary" />
          <span className="font-semibold text-content-strong">Visual Spec Builder</span>
        </button>
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

      <span
        className="min-w-0 flex-1 truncate text-center text-xs text-content-subtle"
        title={formatDocumentTitle(projectName, pageName, fileName)}
      >
        {formatDocumentTitle(projectName, pageName, fileName)}
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

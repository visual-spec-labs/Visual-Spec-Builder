/**
 * MenuBar 드롭다운과 캔버스 컨텍스트 메뉴가 공유하는 목록 렌더링(#152).
 * 항목 타입은 `menuEntry.ts`에 있다(이유는 그 파일 주석 참고).
 *
 * 앵커링(버튼 아래 고정 vs 커서 좌표)은 서로 달라 그 부분은 각자 만든다 —
 * 여기서 공유하는 건 "항목이 무엇이고 어떻게 그려지는가"뿐이다.
 */
import type { MenuEntry } from "./menuEntry";

export type { ActionEntry, MenuEntry, SeparatorEntry, ToggleEntry } from "./menuEntry";

/**
 * 항목 목록을 `<ul role="menu">`로 그린다. 위치는 부모(MenuButton의 `absolute`
 * 래퍼든, ContextMenu의 `fixed` 래퍼든)가 정하고 여기는 항목만 그린다.
 */
export function MenuList({
  entries,
  onCloseMenu,
}: {
  entries: MenuEntry[];
  onCloseMenu: () => void;
}) {
  return (
    <ul
      role="menu"
      className="w-48 rounded-panel border border-line bg-surface py-1 shadow-popover"
    >
      {entries.map((entry, index) =>
        entry.kind === "separator" ? (
          <li key={`sep-${index}`} className="my-1 border-t border-line" />
        ) : (
          <li key={entry.label} role="menuitem">
            <button
              type="button"
              disabled={entry.kind === "action" ? entry.disabled : false}
              onClick={() => {
                if (entry.kind === "action") {
                  if (entry.disabled) return;
                  entry.onSelect();
                  onCloseMenu();
                } else {
                  entry.onToggle();
                }
              }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-content hover:bg-hover disabled:pointer-events-none disabled:text-content-subtle disabled:opacity-40"
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
  );
}

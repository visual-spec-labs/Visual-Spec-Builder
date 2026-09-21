/**
 * MenuBar 드롭다운과 캔버스 컨텍스트 메뉴가 공유하는 항목 타입(#152).
 *
 * `menu.tsx`(렌더링)와 파일을 나누는 이유는 순전히 빌드 경계다 — `nodeContextMenuEntries.ts`
 * 처럼 JSX 없는 tsconfig 프로젝트(test/가 포함된 쪽)에서도 이 타입만 쓰고 싶은데,
 * `.tsx` 파일을 import하면 그 프로젝트에 `--jsx` 설정이 없어 빌드가 깨진다.
 */

export type ActionEntry = {
  kind: "action";
  label: string;
  onSelect: () => void;
  /** root 보호 등으로 지금은 눌러도 뜻이 없을 때. 누르면 onSelect를 부르지 않는다. */
  disabled?: boolean;
};
export type ToggleEntry = {
  kind: "toggle";
  label: string;
  checked: boolean;
  onToggle: () => void;
};
export type SeparatorEntry = { kind: "separator" };

export type MenuEntry = ActionEntry | ToggleEntry | SeparatorEntry;

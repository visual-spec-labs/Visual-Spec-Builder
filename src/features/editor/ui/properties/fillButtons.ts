/**
 * 배경 섹션(겹 목록·stop 목록)이 함께 쓰는 버튼 모양.
 * 새 모양을 만들지 않고 LayerTree에 이미 있는 버튼을 따른다.
 */

/** 겹·stop 머리의 작은 아이콘 버튼. LayerTree 하단(레이어 추가·되돌리기) 버튼과 같다. */
export const iconButtonClass =
  "rounded-control p-0.5 text-content-muted hover:bg-hover hover:text-content disabled:pointer-events-none disabled:opacity-30";

/** 목록에 하나를 더하는 버튼. LayerTree의 "새 페이지"와 같다. */
export const addButtonClass =
  "flex w-full items-center gap-1.5 rounded-control py-1 pr-1 pl-2 text-left text-xs text-content-muted hover:bg-hover hover:text-content";

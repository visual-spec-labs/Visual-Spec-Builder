import type { LucideIcon } from "lucide-react";

/**
 * 레이어 트리·속성 패널이 접혔을 때 공유하는 좁은 레일(#287, 자체 code-review
 * 대응으로 중복 제거) — 펼치기 버튼 하나만 있다. `gridArea`/`border`는 둘의
 * 유일한 차이(배치·테두리 위치)라 삼항으로 완결된 Tailwind 클래스 문자열을
 * 고른다 — 런타임에 클래스 이름을 이어붙이면 Tailwind가 빌드 시점에 찾지
 * 못한다(DESIGN-TOKEN-RULES.md 전례, `EditorLayout.tsx`의 기존 패턴과 같다).
 */
export function PanelRail({
  gridArea,
  border,
  icon: Icon,
  label,
  onExpand,
}: {
  gridArea: "tree" | "props";
  border: "left" | "right";
  icon: LucideIcon;
  label: string;
  onExpand: () => void;
}) {
  const gridAreaClass = gridArea === "tree" ? "[grid-area:tree]" : "[grid-area:props]";
  const borderClass = border === "left" ? "border-l" : "border-r";

  return (
    <aside
      className={`flex flex-col items-center overflow-hidden ${borderClass} border-line bg-surface py-2 ${gridAreaClass}`}
    >
      <button
        type="button"
        onClick={onExpand}
        aria-label={label}
        className="rounded-control p-1 text-content-muted hover:bg-hover hover:text-content"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </aside>
  );
}

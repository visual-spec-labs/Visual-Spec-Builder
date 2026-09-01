import { Frame, Hand, MousePointer2, Type, type LucideIcon } from "lucide-react";

import { useToolStore, type ToolId } from "@/features/editor/store/toolStore";

const TOOLS: { id: ToolId; label: string; Icon: LucideIcon }[] = [
  { id: "select", label: "Select", Icon: MousePointer2 },
  { id: "frame", label: "Frame", Icon: Frame },
  { id: "text", label: "Text", Icon: Type },
  { id: "hand", label: "Hand", Icon: Hand },
];

/**
 * 캔버스 위에 떠 있는 도구 모음.
 * 활성 도구는 toolStore가 값 하나로 들고 있어 언제나 하나만 켜진다.
 * 실제 동작(선택·생성·팬)은 이 값을 읽는 Canvas가 수행한다.
 */
export function Toolbar() {
  const activeTool = useToolStore((state) => state.activeTool);
  const setActiveTool = useToolStore((state) => state.setActiveTool);

  return (
    <div
      role="toolbar"
      aria-label="도구"
      className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-panel border border-line bg-surface-raised p-1 shadow-popover"
    >
      {TOOLS.map(({ id, label, Icon }) => {
        const isActive = activeTool === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTool(id)}
            aria-label={label}
            aria-pressed={isActive}
            className={`flex size-8 items-center justify-center rounded-control ${
              isActive
                ? "bg-primary text-text-on-accent"
                : "text-content-muted hover:bg-hover hover:text-content"
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

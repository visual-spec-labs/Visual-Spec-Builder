import { Frame, Hand, MousePointer2, Type, type LucideIcon } from "lucide-react";
import { useState } from "react";

type ToolId = "select" | "frame" | "text" | "hand";

const TOOLS: { id: ToolId; label: string; Icon: LucideIcon }[] = [
  { id: "select", label: "Select", Icon: MousePointer2 },
  { id: "frame", label: "Frame", Icon: Frame },
  { id: "text", label: "Text", Icon: Type },
  { id: "hand", label: "Hand", Icon: Hand },
];

/**
 * 캔버스 위에 떠 있는 도구 모음. 활성 도구는 로컬 UI 상태로만 표시한다
 * (실제 도구 동작·비즈니스 로직 없음).
 */
export function Toolbar() {
  const [activeTool, setActiveTool] = useState<ToolId>("select");

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

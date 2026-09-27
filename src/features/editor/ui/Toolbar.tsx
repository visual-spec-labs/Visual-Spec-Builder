import { Frame, Hand, MousePointer2, Type, type LucideIcon } from "lucide-react";

import { useToolStore, type ToolId } from "@/features/editor/store/toolStore";
import { useViewStore } from "@/features/editor/store/viewStore";

// key 는 표시용 글자다. 실제 판정은 canvasInput.TOOL_KEYS 가 event.code 로 한다
// (한/영 전환에 죽지 않게). 둘이 어긋나면 툴팁이 거짓말을 하므로 함께 고친다.
const TOOLS: { id: ToolId; label: string; key: string; Icon: LucideIcon }[] = [
  { id: "select", label: "Select", key: "V", Icon: MousePointer2 },
  { id: "frame", label: "Frame", key: "F", Icon: Frame },
  { id: "text", label: "Text", key: "T", Icon: Type },
  { id: "hand", label: "Hand", key: "H", Icon: Hand },
];

/**
 * 캔버스 위에 떠 있는 도구 모음.
 * 활성 도구는 toolStore가 값 하나로 들고 있어 언제나 하나만 켜진다.
 * 실제 동작(선택·생성·팬)은 이 값을 읽는 Canvas가 수행한다.
 */
export function Toolbar() {
  const activeTool = useToolStore((state) => state.activeTool);
  const setActiveTool = useToolStore((state) => state.setActiveTool);

  // 캔버스를 아래쪽까지 내리면 도구 모음이 쏙 들어갔다가, 조금이라도 올리면 다시
  // 올라온다. 그 자리에 아트보드의 하단 리사이즈 핸들이 와서 도구 모음에 가리기
  // 때문이다 — 캔버스 여백(p-8)은 32px 뿐이라 도구 모음 높이를 못 덮는다.
  //
  // 맨 밑에 **닿고 나서**가 아니라 닿기 조금 전에 비킨다(TOOLBAR_CLEARANCE_PX).
  // 겹친 뒤에 숨으면 그 사이 핸들을 못 누르는 구간이 생긴다.
  //
  // 내용이 뷰포트보다 짧아 스크롤이 없을 때는 숨기지 않는다(isScrolledToBottom 이
  // false 를 돌려준다) — 숨기면 도구를 영영 고를 수 없다.
  const hidden = useViewStore((state) => state.canvasAtBottom);

  return (
    // aria-hidden 과 pointer-events-none 을 함께 건다 — 화면 밖으로 밀려난 뒤에도
    // 탭 순서와 스크린 리더에 남아 있으면 "보이지 않는 버튼"이 된다.
    //
    // 그냥 아래로 미끄러뜨리지 않고 **바닥의 작은 구멍으로 빨려드는** 느낌을 준다.
    // origin-bottom 이라 축소의 기준점이 아래 모서리 한가운데다 — 가로를 크게,
    // 세로를 덜 줄이면서 동시에 내려가면 그 점으로 말려 들어가는 것처럼 보인다.
    // 사라질 때는 ease-in(점점 빨라짐)이라 빨려드는 가속이 생기고, 돌아올 때는
    // ease-out 으로 짧게 튀어나온다.
    //
    // `[grid-area:canvas]` — #155가 캔버스 아래에 자연어 입력창 행을 더하면서
    // 기준을 **셸에서 캔버스 영역으로** 옮겼다(docs/08 8절 물음 6의 답). 셸 기준의
    // `bottom-4` 는 그대로 두면 새 행 위에 얹히고, 새 행은 높이가 `auto` 라
    // `bottom` 값을 상수로 올려 피할 수도 없다. 절대 배치된 그리드 컨테이너의
    // 자식은 grid-placement 가 있으면 **그 영역**이 담는 블록이 되므로
    // (CSS Grid 명세), 이 한 줄이 도구 모음을 캔버스 바닥 기준으로 되돌린다.
    // 덤으로 좌우 패널을 접어도 캔버스 한가운데에 그대로 선다.
    <div
      role="toolbar"
      aria-label="도구"
      aria-hidden={hidden}
      className={`absolute bottom-4 left-1/2 z-10 flex origin-bottom items-center gap-1 rounded-panel border border-line bg-surface-raised p-1 shadow-popover transition-[transform,opacity] [grid-area:canvas] ${
        hidden
          ? "pointer-events-none -translate-x-1/2 translate-y-[calc(100%+1.25rem)] scale-x-[0.28] scale-y-[0.5] opacity-0 duration-300 ease-in"
          : "-translate-x-1/2 translate-y-0 scale-100 opacity-100 duration-200 ease-out"
      }`}
    >
      {TOOLS.map(({ id, label, key, Icon }) => {
        const isActive = activeTool === id;
        // 단축키를 aria-label 과 title 양쪽에 넣는다. 툴팁이 없으면 단축키가
        // 있다는 사실 자체를 아무도 모르고, aria-label 에만 넣으면 눈으로 볼 수 없다.
        const hint = `${label} (${key})`;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTool(id)}
            aria-label={hint}
            title={hint}
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

import { useEffect, useRef } from "react";
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
  const rootRef = useRef<HTMLDivElement>(null);

  // `aria-hidden`·pointer-events 만으로는 숨긴 상태에서도 내부 button이 탭 순서에
  // 남는다(이슈 #275) — 실제로 Tab이 Frame 버튼까지 들어갔다. `inert`를 같이 걸어야
  // 포커스·탭 순서·스크린 리더 전부에서 제외된다. `aria-hidden`은 그대로 둔다 —
  // `inert` 지원이 아직 덜 퍼진 조합(예: 구형 스크린 리더 조합)에 대한 보강이고,
  // `src/app/App.tsx`의 저장 충돌 모달 뒤 편집기(`inert={paused || undefined}`)와
  // 같은 이중 표기다. `false`가 아니라 `undefined`를 쓰는 이유도 같다 — React가
  // `inert="false"`를 실제 속성으로 찍어 버리는 버전이 있어, 아예 속성을 없앤다.
  //
  // **숨는 순간의 포커스.** 도구 버튼에 포커스가 있는 채로 캔버스를 끝까지 내리면
  // (예: Tab으로 Frame을 고른 직후) 네이티브 `inert`가 그 포커스를 자동으로 치워
  // 주는지는 브라우저마다 보장이 다르다 — 직접 치운다. 포커스가 보이지도, 눌리지도
  // 않는 자리에 남아 있으면 Tab/Shift+Tab을 눌러도 화면이 안 움직이는 것처럼
  // 보인다. 어디로 보낼지 추리하지 않고 `blur()`만 한다 — 대부분의 브라우저가
  // body로 포커스를 돌린다.
  //
  // **그다음 Tab이 "문서 탐색"이 되려면 신호가 하나 더 필요하다(#275 리뷰 대응).**
  // `canvasKeys.ts`는 선택이 있으면 Tab을 형제 이동(#151)으로 가로채는데, 그 판정은
  // `event.target`의 태그만 본다 — `body`는 버튼·링크가 아니라서 예외를 못 받는다.
  // 방금까지 도구 버튼을 쓰고 있었다는 맥락(=패널·도구 모음으로 계속 이동하려던
  // 참이었을 가능성)을 `canvasKeys.ts`는 알 길이 없으므로, `viewStore`의
  // `toolbarFocusHandoffPending`을 켜서 "다음 Tab 한 번은 형제 이동을 비켜서라"
  // 라고 알려준다(소비 쪽은 canvasKeys.ts 참고). 캔버스를 클릭해 선택하는 주
  // 사용 경로는 이 신호를 켜지 않으므로 형제 이동(#151 §2의 "캔버스 포커스에서만
  // 가로챈다")은 그대로 동작한다 — #151의 주 사용 경로를 넓히는 게 아니라, 도구
  // 모음이 포커스를 빼앗아 간 이 한 번의 전환만 좁게 바로잡는다.
  //
  // **다시 보이면** 포커스를 도구 모음으로 되돌리지 않는다 — 사용자는 스크롤했을
  // 뿐 도구를 쓰려던 게 아니라서, 포커스를 가로채면 방금 하던 입력(캔버스 조작 등)
  // 이 끊긴다. `inert`가 풀리면 버튼은 다시 탭 순서에 들어가는 것으로 충분하다.
  //
  // **신호는 Tab을 누르기 전에 다시 보여도 지우지 않는다(#275 리뷰 4차 대응).**
  // 처음엔 "다시 보인 뒤에는 막 떨어진 포커스 맥락이 끝난 것으로 본다"고 보고
  // 여기서 무조건 껐는데, 그러면 포커스가 아직 `body`에 머물러 있고(= 사용자가
  // Tab을 누르기 전에 스크롤만 되돌린 상태) `selectedId`도 그대로인 채 신호만
  // 사라져 버린다. 다음 Tab/Shift+Tab은 신호 없이 `canvasKeys.ts`의 형제 이동
  // (#151)에 다시 잡힌다 — 사용자는 캔버스를 다시 선택한 적이 없는데 도구
  // 모음에서 시작된 문서 탐색 기회를 그냥 스크롤 때문에 잃는다. `activeElement`가
  // `body`를 벗어났다면(Tab으로 이미 소비됐거나 다른 조작으로 포커스가 실제로
  // 옮겨졌다면) 그때는 지워도 안전하다 — "막 떨어진 포커스" 맥락이 그 시점에는
  // 이미 끝나 있다.
  useEffect(() => {
    if (!hidden) {
      if (document.activeElement !== document.body) {
        useViewStore.getState().setToolbarFocusHandoffPending(false);
      }
      return;
    }
    const root = rootRef.current;
    const active = document.activeElement;
    if (root !== null && active instanceof HTMLElement && root.contains(active)) {
      active.blur();
      useViewStore.getState().setToolbarFocusHandoffPending(true);
    }
  }, [hidden]);

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
      ref={rootRef}
      role="toolbar"
      aria-label="도구"
      aria-hidden={hidden}
      inert={hidden || undefined}
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

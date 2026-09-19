import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

/**
 * 확대율과 수식키에 딸린 상태.
 *
 * 둘 다 **스크롤을 만지거나 누르고 있는 동안을 추적하는** 쪽이라, 재기만 하는
 * 오버레이 훅(`canvasOverlays.ts`)과 성격이 다르다. `Canvas.tsx` 에서 잘라 온
 * 것이고 동작은 바뀌지 않았다(2026-09-19·이슈 #148).
 */

/**
 * Alt(윈도우) / Option(맥)를 누르고 있는가. 거리 재기의 수식키다.
 *
 * `keydown`의 `altKey`만 보면 **Alt만 눌렀을 때**를 놓친다 — 다른 키와 함께
 * 눌러야 이벤트가 오기 때문이다. `keyup`과 `blur`까지 봐야 누르고 있는 동안을
 * 계속 안다. `blur`가 필요한 이유는 스페이스 팬과 같다 — Alt+Tab 으로 창을
 * 옮기면 `keyup`이 영영 오지 않아 "누르고 있는 중"에 갇힌다. Alt+Tab 은
 * 하필 Alt 를 쓰는 조합이라 여기서는 더 잘 일어난다.
 */
export function useAltHeld(): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    function sync(event: KeyboardEvent) {
      setHeld((prev) => (prev === event.altKey ? prev : event.altKey));
    }
    function release() {
      setHeld((prev) => (prev ? false : prev));
    }

    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("blur", release);
    };
  }, []);

  return held;
}

/**
 * 확대 직전에 적어 두는 "커서 밑에 있던 지점".
 *
 * 화면 좌표(`clientX/Y`)와, 그 지점이 아트보드 안에서 차지하는 **스펙 좌표**를
 * 함께 들고 있다. 확대율이 바뀌어도 스펙 좌표는 그대로라, 새 배율에서 그 점이
 * 어디로 갔는지 계산할 수 있다.
 */
interface PointAnchor {
  fit?: false;
  clientX: number;
  clientY: number;
  specX: number;
  specY: number;
}

/** 화면 맞춤 — 붙잡을 점이 없다. 새 배율로 그려진 뒤 문서 위로 보낸다. */
interface FitAnchor {
  fit: true;
}

export type ZoomAnchor = PointAnchor | FitAnchor;

export function readZoomAnchor(
  outer: HTMLDivElement | null,
  clientX: number,
  clientY: number,
): ZoomAnchor | null {
  if (outer === null) return null;
  const rect = outer.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  // 바깥 박스의 크기가 곧 `스펙 크기 × 배율`이라, 비율로 나누면 배율을 몰라도
  // 스펙 좌표가 나온다. 아트보드가 `mx-auto`로 가운데 놓여 위치가 배율에 따라
  // 달라지는데, 비율로 두면 그 영향도 함께 빠진다.
  return {
    clientX,
    clientY,
    specX: (clientX - rect.left) / rect.width,
    specY: (clientY - rect.top) / rect.height,
  };
}

/**
 * 확대 뒤에 스크롤을 맞춰, 커서 밑에 있던 지점이 제자리에 남게 한다.
 *
 * 이게 없으면 확대할 때마다 보던 곳이 화면 밖으로 밀려나 매번 다시 찾아 스크롤해야
 * 한다. 피그마·지도 앱이 모두 커서를 기준으로 확대하는 이유다.
 *
 * 계산이 아니라 **다시 재서** 맞춘다 — 아트보드가 `mx-auto`라 배율이 바뀌면 박스의
 * 좌우 여백까지 함께 변하는데, 그걸 미리 식으로 풀면 패널 접기·스크롤바 등장 같은
 * 다른 변수에 금방 어긋난다. 새 배율로 그려진 뒤 실측하면 그런 게 전부 반영된다.
 *
 * `useLayoutEffect`라야 한다. 페인트 뒤에 스크롤을 고치면 한 프레임 동안 화면이
 * 튀는 것이 눈에 보인다.
 */
export function useZoomAnchor(
  mainRef: RefObject<HTMLElement | null>,
  outerRef: RefObject<HTMLDivElement | null>,
  anchorRef: RefObject<ZoomAnchor | null>,
  zoom: number,
) {
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    anchorRef.current = null;

    const main = mainRef.current;
    const outer = outerRef.current;
    if (anchor === null || main === null || outer === null) return;

    // 화면 맞춤은 문서 위·가운데로 보낸다. 여기는 새 배율로 그려진 **뒤**라
    // scrollWidth 가 새 값이다 — 호출 시점에 읽으면 옛 너비를 쓰게 된다.
    if (anchor.fit === true) {
      main.scrollTop = 0;
      main.scrollLeft = Math.max(0, (main.scrollWidth - main.clientWidth) / 2);
      return;
    }

    const rect = outer.getBoundingClientRect();
    const nowX = rect.left + anchor.specX * rect.width;
    const nowY = rect.top + anchor.specY * rect.height;

    main.scrollLeft += nowX - anchor.clientX;
    main.scrollTop += nowY - anchor.clientY;
  }, [mainRef, outerRef, anchorRef, zoom]);
}

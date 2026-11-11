import { describe, expect, it } from "vitest";

import {
  nodeSelector,
  relativeRect,
  sameRect,
  type Rect,
} from "@/features/editor/ui/selectionRect";

/** getBoundingClientRect 결과를 흉내 낸다 — 이 계산이 쓰는 네 값만 있으면 된다. */
function rect(left: number, top: number, width: number, height: number): Rect {
  return { left, top, width, height };
}

describe("relativeRect", () => {
  it("대상의 뷰포트 좌표를 기준 상자 기준으로 옮긴다", () => {
    const result = relativeRect(rect(340, 220, 200, 100), rect(300, 200, 1440, 900));

    expect(result).toEqual({ left: 40, top: 20, width: 200, height: 100 });
  });

  it("스크롤로 둘이 함께 움직여도 결과가 같다", () => {
    // 두 값 모두 같은 순간의 뷰포트 좌표라 스크롤 오프셋이 상쇄된다.
    // 이 성질 덕분에 캔버스 스크롤 이벤트를 따로 듣지 않아도 된다.
    const before = relativeRect(rect(340, 220, 200, 100), rect(300, 200, 1440, 900));
    const after = relativeRect(rect(340, -280, 200, 100), rect(300, -300, 1440, 900));

    expect(after).toEqual(before);
  });

  it("확대된 값을 그대로 둔다 — 오버레이가 확대되지 않는 상자에 놓이기 때문이다", () => {
    // 50% 축소 상태에서 200x100 노드는 화면에 100x50으로 그려진다.
    // 오버레이도 화면 좌표계에 있으므로 나눠 되돌리지 않는다.
    const result = relativeRect(rect(320, 210, 100, 50), rect(300, 200, 720, 450));

    expect(result).toEqual({ left: 20, top: 10, width: 100, height: 50 });
  });

  it("기준 상자 밖으로 삐져나온 노드는 음수 좌표가 된다", () => {
    // 자식이 아트보드를 넘칠 수 있다(Figma와 동일). 잘라내지 않는다.
    const result = relativeRect(rect(280, 180, 200, 100), rect(300, 200, 1440, 900));

    expect(result).toEqual({ left: -20, top: -20, width: 200, height: 100 });
  });

  it("서브픽셀 값을 소수 2자리로 끊는다", () => {
    const result = relativeRect(
      rect(340.123456, 220.987654, 200.5555, 100.4444),
      rect(300, 200, 1440, 900),
    );

    expect(result).toEqual({ left: 40.12, top: 20.99, width: 200.56, height: 100.44 });
  });
});

describe("sameRect", () => {
  const base: Rect = { left: 40, top: 20, width: 200, height: 100 };

  it("네 값이 모두 같으면 같다고 본다", () => {
    expect(sameRect(base, { ...base })).toBe(true);
  });

  it("한 값이라도 다르면 다르다고 본다", () => {
    expect(sameRect(base, { ...base, left: 41 })).toBe(false);
    expect(sameRect(base, { ...base, top: 21 })).toBe(false);
    expect(sameRect(base, { ...base, width: 201 })).toBe(false);
    expect(sameRect(base, { ...base, height: 101 })).toBe(false);
  });

  it("둘 다 null이면 같다 — 선택이 없는 상태가 이어질 때 리렌더를 만들지 않는다", () => {
    expect(sameRect(null, null)).toBe(true);
  });

  it("한쪽만 null이면 다르다 — 선택이 생기거나 사라진 순간이다", () => {
    expect(sameRect(null, base)).toBe(false);
    expect(sameRect(base, null)).toBe(false);
  });
});

describe("nodeSelector", () => {
  it("노드 id로 속성 선택자를 만든다", () => {
    expect(nodeSelector("frame-1")).toBe('[data-node-id="frame-1"]');
  });

  it("따옴표가 든 id에도 선택자가 깨지지 않는다", () => {
    // 가져온 스펙의 id는 무엇이든 될 수 있다.
    expect(nodeSelector('a"b')).toBe('[data-node-id="a\\"b"]');
  });

  it("역슬래시를 먼저 이스케이프해 따옴표 이스케이프를 무효화하지 않는다", () => {
    expect(nodeSelector("a\\b")).toBe('[data-node-id="a\\\\b"]');
    expect(nodeSelector('a\\"b')).toBe('[data-node-id="a\\\\\\"b"]');
  });
});

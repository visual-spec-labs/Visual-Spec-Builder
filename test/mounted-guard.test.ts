import { describe, expect, it } from "vitest";

import { createMountedGuard } from "@/features/editor/ui/mountedGuard";

/**
 * React 18 StrictMode(`src/main.tsx`)는 개발 모드에서 모든 effect를
 * setup → cleanup → setup으로 한 번 더 왕복시킨다. `CopyButton.tsx`가 이
 * 가드를 쓰는 effect는 처음에는 cleanup만 있고 setup에서 `true`로 되돌리지
 * 않아서, 그 왕복의 첫 cleanup 뒤로 `isMounted()`가 영영 `false`로 남는
 * 버그였다(#283 리뷰 2차 대응) — 실제로 마운트돼 있는데도 "복사됨"/"복사
 * 실패" 표시가 전혀 안 뜬다. `npx visual-spec`도 Vite 개발 서버(StrictMode
 * 포함)라 이 버그는 테스트 환경이 아니라 실사용 경로에서도 그대로 터진다.
 */
describe("createMountedGuard — StrictMode의 setup→cleanup→setup을 견딘다(#283)", () => {
  it("setup 전에는 마운트 상태가 아니다", () => {
    const guard = createMountedGuard();
    expect(guard.isMounted()).toBe(false);
  });

  it("setup 직후에는 마운트 상태다", () => {
    const guard = createMountedGuard();
    guard.setup();
    expect(guard.isMounted()).toBe(true);
  });

  it("cleanup 뒤에는 마운트 상태가 아니다", () => {
    const guard = createMountedGuard();
    guard.setup();
    guard.cleanup();
    expect(guard.isMounted()).toBe(false);
  });

  it("StrictMode의 setup→cleanup→setup 뒤에는 다시 마운트 상태다 — 수정 전에는 false로 남는 버그였다", () => {
    const guard = createMountedGuard();
    guard.setup(); // 최초 마운트
    guard.cleanup(); // StrictMode가 즉시 거는 첫 cleanup
    guard.setup(); // StrictMode가 즉시 다시 거는 두 번째 setup(= 실제 마운트 상태)

    expect(guard.isMounted()).toBe(true);
  });

  it("StrictMode 왕복 뒤 진짜 언마운트(마지막 cleanup)하면 다시 false다", () => {
    const guard = createMountedGuard();
    guard.setup();
    guard.cleanup();
    guard.setup();
    guard.cleanup(); // 진짜 언마운트 — 이 뒤로는 setup이 다시 오지 않는다

    expect(guard.isMounted()).toBe(false);
  });
});

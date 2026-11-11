/**
 * `useEffect(() => { ...; return cleanup; }, [])`로 "지금 마운트돼 있는가"를
 * 추적할 때, React 18 StrictMode(`src/main.tsx`)가 개발 모드에서 모든 effect를
 * setup → cleanup → setup 순서로 한 번 더 왕복시킨다는 사실을 놓치기 쉽다(#283
 * 리뷰 대응). cleanup에서만 `false`로 두고 setup에서 `true`로 되돌리지 않으면,
 * 그 왕복의 첫 cleanup 뒤로 값이 영영 `false`로 남는다 — 실제로는 멀쩡히 마운트돼
 * 있는데도 "언마운트됨"으로 잘못 읽는다. 저장소의 `pnpm dev`와
 * `VISUAL_SPEC_REACT_DEV=1`로 띄운 GUI가 이 개발 모드다. CLI 기본 경로는 #314부터 React
 * production이라 이중 실행이 없지만, effect를 다시 부르는 다른 경우(키가 바뀐 재마운트 등)에도
 * 같은 짝 맞추기가 필요하므로 이 가드는 그대로 쓴다.
 *
 * `setup`을 꼭 불러야 하는 이유가 이것이다 — cleanup과 짝을 맞춰 "이번 왕복은
 * 끝났고 다시 마운트됐다"를 명시적으로 알린다. 이 객체 자체는 React를 모른다 —
 * `useEffect`가 그 안에서 `setup`/`cleanup`을 부르는 배선만 한다.
 */
export interface MountedGuard {
  /** effect의 setup에서 부른다 — 최초 마운트와 StrictMode의 재마운트 둘 다. */
  setup(): void;
  /** effect의 cleanup(반환 함수)에서 부른다. */
  cleanup(): void;
  /** 지금 마운트 상태인가 — 비동기 작업이 끝난 뒤 이걸로 레이스를 가른다. */
  isMounted(): boolean;
}

export function createMountedGuard(): MountedGuard {
  let mounted = false;
  return {
    setup() {
      mounted = true;
    },
    cleanup() {
      mounted = false;
    },
    isMounted() {
      return mounted;
    },
  };
}

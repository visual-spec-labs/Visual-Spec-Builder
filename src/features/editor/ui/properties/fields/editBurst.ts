import { useRef } from "react";

/**
 * 타이핑 burst 하나를 추적하는 상태 기계(#121, #132).
 *
 * 입력칸은 키 입력마다 커밋한다. 그대로 두면 한 글자가 undo 한 단계가 되어
 * Ctrl+Z 한 번이 마지막 한 글자만 되돌린다. 그래서 "이번 커밋이 직전 커밋과
 * 같은 편집을 잇는 중인가"를 입력칸이 로컬로 기억해뒀다가
 * `setNodeField`/`setPageField`의 `continueEdit`으로 넘긴다.
 *
 * 스토어가 "직전과 같은 노드·경로면 병합"을 스스로 판단하는 방식은 일부러 안
 * 쓴다 — 레이어 트리 표시 토글이나 캔버스 리사이즈 드래그처럼 같은 경로를
 * 반복 호출해도 매번 별개의 편집인 호출부까지 잘못 합쳐버린다. 병합 여부는
 * 그걸 실제로 아는 호출부만 정한다(editorStore.ts의 reconciledHistory 주석 참고).
 */
export interface EditBurst {
  /**
   * 지금 커밋이 직전 커밋과 같은 burst를 잇는지 답하면서 burst를 이어 간다.
   * burst의 첫 커밋이면 false(새 undo 단계), 그다음부터는 true(직전 체크포인트에 덮어쓰기).
   */
  next: () => boolean;
  /** burst를 끊는다. 다음 커밋은 다시 false — 별개의 undo 단계가 된다. */
  end: () => void;
}

/**
 * React를 모르는 순수 구현. 훅 없이 그대로 테스트한다.
 * (이 저장소에는 컴포넌트/훅 테스트 도구가 없다 — vitest environment가 node다.)
 */
export function createEditBurst(): EditBurst {
  let active = false;

  return {
    next() {
      const continueEdit = active;
      active = true;
      return continueEdit;
    },
    end() {
      active = false;
    },
  };
}

/**
 * 컴포넌트 한 인스턴스가 살아 있는 동안 유지되는 burst 추적기.
 *
 * state가 아니라 ref다 — burst가 이어지는지는 화면에 안 그려지므로 바뀌어도
 * 리렌더가 필요 없고, 오히려 값이 자기 자신의 커밋으로 되돌아오는 매 리렌더마다
 * 초기화되면 안 된다. 끊는 건 오직 `end`(=blur)다: 외부 요인(다른 노드 선택,
 * undo/redo)으로 값이 바뀌는 경우는 실제로는 항상 먼저 포커스가 빠지면서 blur가
 * 앞선다 — 되돌리기 단축키는 입력칸 포커스 중엔 아예 안 받고
 * (EDITOR_STORE_CONTRACT.md 참고), 버튼 클릭도 mousedown에서 blur가 click보다
 * 먼저 난다.
 */
export function useEditBurst(): EditBurst {
  const ref = useRef<EditBurst | null>(null);
  if (ref.current === null) {
    ref.current = createEditBurst();
  }
  return ref.current;
}

/**
 * 리사이즈 드래그 한 번을 undo 한 단계로 묶는 판단기(#207).
 *
 * 핸들을 끄는 동안 mousemove마다 크기를 커밋한다. 그대로 두면 이동 한 번이
 * undo 한 단계가 되어 Ctrl+Z를 이동 횟수만큼 눌러야 원래 크기로 돌아간다(우하단
 * 핸들은 너비·높이를 따로 커밋해 이동 한 번에 두 단계씩 쌓였다). 그래서 제스처의
 * 첫 커밋만 새 단계로 쌓고 나머지는 `continueEdit: true`로 그 단계에 덮어쓴다.
 *
 * **"이미 새 단계를 만들었는가"는 값이 실제로 바뀐 커밋이 있었는지로 판단한다.**
 * 값이 그대로인 커밋을 첫 커밋으로 세면 안 된다 — 스토어는 같은 값 쓰기도 새
 * 단계로 쌓아 빈 undo 단계가 생기고, 스토어가 그 커밋을 no-op으로 버리는 경우라면
 * 다음 커밋이 `continueEdit: true`로 올라가 직전의 *남의* undo 단계를 덮어쓴다.
 * 그래서 직전에 커밋한 값과 같은 값은 아예 커밋 목록에 넣지 않는다 —
 * `TextField`(#132)·`useDraftInput`(#209)의 "값이 그대로면 커밋하지 않음" 가드와
 * 같은 생각이다(fields/unchangedCommit.ts 주석 참고).
 *
 * 비교 기준은 시작 크기(숫자)다. Fill/Hug 노드는 실측값을 시작 크기로 삼으므로
 * (Canvas.tsx의 startResize), 그 축으로 움직이지 않으면 커밋하지 않아 Fill/Hug가
 * 그대로 남는다. 반대로 한 번 움직였다가 시작 크기로 돌아오는 이동은 직전 값과
 * 다르므로 커밋한다 — 이때 Fill/Hug였던 축은 시작 크기의 고정값이 된다.
 *
 * React·스토어를 모르는 순수 구현이라 그대로 테스트한다(editBurst.ts와 같은 방식).
 */

export type ResizeAxis = "width" | "height";

/** 이번 이동이 원하는 크기. 핸들이 다루지 않는 축은 비워 둔다(e는 width만). */
export type ResizeTarget = Partial<Record<ResizeAxis, number>>;

/** 실제로 스토어에 보낼 커밋 하나. 목록 순서대로 보내야 `continueEdit`이 맞는다. */
export interface ResizeCommit {
  axis: ResizeAxis;
  value: number;
  /** false면 새 undo 단계, true면 이 제스처가 만든 단계에 덮어쓴다. */
  continueEdit: boolean;
}

export interface ResizeGesture {
  /** 이번 이동에서 보낼 커밋을 정하고, 그 커밋을 보낸 것으로 기억한다. */
  commits: (target: ResizeTarget) => ResizeCommit[];
}

const AXES: readonly ResizeAxis[] = ["width", "height"];

export function createResizeGesture(start: Record<ResizeAxis, number>): ResizeGesture {
  const last = { ...start };
  // 이 제스처가 이미 undo 단계를 하나 만들었는가 — 값이 바뀐 커밋을 보냈을 때만 true.
  let stepCreated = false;

  return {
    commits(target) {
      const result: ResizeCommit[] = [];
      for (const axis of AXES) {
        const value = target[axis];
        if (value === undefined || value === last[axis]) continue;

        result.push({ axis, value, continueEdit: stepCreated });
        stepCreated = true;
        last[axis] = value;
      }
      return result;
    },
  };
}

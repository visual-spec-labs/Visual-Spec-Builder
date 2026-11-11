import { Plus, X } from "lucide-react";
import { useRef } from "react";

import type { Background, LinearFill } from "@/features/editor/schema";

import {
  addStop,
  canRemoveStop,
  percentFromAt,
  removeStop,
  setLinearAngle,
  setStopColor,
  setStopPosition,
  stopIndexAfterPosition,
} from "./backgroundPatch";
import { addButtonClass, iconButtonClass } from "./fillButtons";
import { ColorField, FieldLabel, FieldRow, NumberField } from "./fields";

interface LinearFillFieldsProps {
  fill: LinearFill;
  /** 이 겹의 배열 자리 */
  index: number;
  background: Background;
  onCommit: (next: Background | undefined, continueEdit?: boolean) => void;
}

/**
 * linear 겹의 칸 — 각도와 stop 목록(색 + 위치 %).
 *
 * 위치는 %(0~100)로 보이고 `at = % / 100`으로 저장된다. 위치를 바꾸면 stop이
 * 위치순으로 다시 정렬된다(backgroundPatch.setStopPosition) — 그래서 타이핑 중에도
 * 칸이 목록에서 자리를 옮길 수 있다. 그때 포커스와 타이핑 burst가 그 stop을
 * 따라가도록 key를 stop을 따라 옮긴다(`useStopKeys`).
 */
export function LinearFillFields({ fill, index, background, onCommit }: LinearFillFieldsProps) {
  const keys = useStopKeys(fill.stops.length);
  const removable = canRemoveStop(fill);

  function updatePosition(stopIndex: number, percent: number, continueEdit: boolean) {
    const next = setStopPosition(background, index, stopIndex, percent);
    if (next === background) return;
    // 커밋으로 다시 그려지기 전에 key를 새 자리로 옮겨 둔다.
    keys.move(stopIndex, stopIndexAfterPosition(fill.stops, stopIndex, percent));
    onCommit(next, continueEdit);
  }

  function remove(stopIndex: number) {
    const next = removeStop(background, index, stopIndex);
    if (next === background) return;
    keys.remove(stopIndex);
    onCommit(next);
  }

  return (
    <>
      <NumberField
        label="각도"
        value={fill.angle}
        onChange={(angle, continueEdit) =>
          onCommit(setLinearAngle(background, index, angle), continueEdit)
        }
        min={0}
        max={360}
        maxExclusive
        unit="°"
      />

      <div className="flex flex-col gap-2">
        {fill.stops.map((stop, stopIndex) => (
          <div key={keys.list[stopIndex]} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <FieldLabel>{`정지점 ${stopIndex + 1}`}</FieldLabel>
              <button
                type="button"
                onClick={() => remove(stopIndex)}
                // 스키마가 stop 2개 이상을 요구한다.
                disabled={!removable}
                aria-label={`정지점 ${stopIndex + 1} 삭제`}
                title={removable ? "삭제" : "정지점은 2개 이상이어야 합니다"}
                className={iconButtonClass}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
            {/* 색 칸(스와치·hex·불투명도)은 한 줄을 다 써야 hex가 찌그러지지 않는다. */}
            <ColorField
              label="색"
              value={stop.color}
              onChange={(color, continueEdit) =>
                onCommit(setStopColor(background, index, stopIndex, color), continueEdit)
              }
            />
            <FieldRow>
              <NumberField
                label="위치"
                value={percentFromAt(stop.at)}
                onChange={(percent, continueEdit = false) =>
                  updatePosition(stopIndex, percent, continueEdit)
                }
                min={0}
                max={100}
                unit="%"
              />
            </FieldRow>
          </div>
        ))}

        <button
          type="button"
          onClick={() => {
            const next = addStop(background, index);
            if (next === background) return;
            // 새 stop은 정렬된 자리에 끼어든다 — 그 자리에 새 key를 넣는다.
            const stops = next?.[index]?.type === "linear" ? next[index].stops : [];
            keys.insert(stops.findIndex((s) => !fill.stops.includes(s)));
            onCommit(next);
          }}
          className={addButtonClass}
        >
          <Plus size={13} className="shrink-0" aria-hidden="true" />
          <span>정지점 추가</span>
        </button>
      </div>
    </>
  );
}

/**
 * stop 칸의 React key 목록. stop에는 id가 없어 자리로 key를 달면, 위치를 고치다
 * stop이 정렬로 자리를 옮기는 순간 포커스가 있던 칸이 **다른 stop**을 보여주게 되고
 * 타이핑 burst도 다른 칸으로 끊긴다. 그래서 패널이 일으킨 자리 이동(정렬·삭제·추가)에는
 * key를 함께 옮긴다.
 *
 * Undo나 다른 노드 선택처럼 바깥에서 바뀐 목록은 개수만 맞춘다 — 그때 key가 엉뚱한
 * stop에 붙어도 칸은 값이 바뀌면 draft를 새로 맞추므로(useDraftInput) 보이는 값은 맞다.
 * 그런 변경은 늘 포커스가 빠진 뒤에 일어난다(editBurst.ts 참고).
 */
function useStopKeys(count: number) {
  const ref = useRef<{ list: string[]; next: number } | null>(null);
  if (ref.current === null) ref.current = { list: [], next: 0 };
  const state = ref.current;

  function newKey(): string {
    state.next += 1;
    return `stop-${state.next}`;
  }

  while (state.list.length < count) state.list.push(newKey());
  if (state.list.length > count) state.list.length = count;

  return {
    list: state.list,
    move(from: number, to: number) {
      const [key] = state.list.splice(from, 1);
      state.list.splice(to, 0, key);
    },
    remove(at: number) {
      state.list.splice(at, 1);
    },
    insert(at: number) {
      state.list.splice(at, 0, newKey());
    },
  };
}

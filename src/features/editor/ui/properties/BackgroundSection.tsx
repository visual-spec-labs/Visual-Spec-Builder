import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import type { Background, Fill } from "@/features/editor/schema";

import {
  addFill,
  canMoveFill,
  changeFillType,
  moveFill,
  removeFill,
  setSolidColor,
  type FillType,
} from "./backgroundPatch";
import { addButtonClass, iconButtonClass } from "./fillButtons";
import { LinearFillFields } from "./LinearFillFields";
import { PropertySection } from "./PropertySection";
import { useNodeField } from "./useNodeField";
import { ColorField, FieldLabel, SegmentedControl } from "./fields";

const FILL_TYPE_OPTIONS = [
  { value: "solid", content: "단색", title: "단색 (solid)" },
  { value: "linear", content: "선형", title: "선형 그라디언트 (linear)" },
] as const;

/**
 * 배경 — 채우기 겹 목록 편집기(#127).
 *
 * `background`를 갖는 frame · button · input이 공유한다. 예전에는
 * FrameProperties 안에만 있어 button·input은 편집할 수 없었다(#92). 섹션이 공유라
 * 여기 한 곳만 고치면 세 타입에 다 반영된다.
 *
 * 목록은 배열 순서 그대로 위에서 아래로 보인다 — 위가 배열 앞, 곧 맨 위 겹이다
 * (docs/13-background-fill-design.md, Figma 패널과 같은 방향). 겹마다 종류(solid /
 * linear)와 위/아래 이동·삭제가 있고, "추가"는 맨 위에 solid 한 겹을 넣는다.
 *
 * 쓰기는 전부 backgroundPatch.ts의 순수 함수가 완전한 배열을 만들고 여기서
 * `setBackground` 한 번으로 커밋한다. 구조 조작(추가·삭제·이동·종류 전환·stop
 * 추가/삭제)은 버튼 한 번이 Undo 한 단계이고, 색·숫자 칸의 타이핑은 `continueEdit`
 * burst로 한 단계에 합쳐진다.
 */
export function BackgroundSection() {
  const [background, setBackground] = useNodeField<Background | undefined>("background");
  const fills = background ?? [];

  /**
   * patch 결과를 커밋한다. 같은 값이면 patch가 받은 배열을 그대로 돌려준다 —
   * 커밋하지 않는다(#209). continueEdit(#121)은 그대로 넘긴다 — 안 그러면 색·숫자
   * 칸의 타이핑 burst가 병합되지 않고 키 입력마다 undo 단계가 쌓인다.
   */
  function commit(next: Background | undefined, continueEdit?: boolean) {
    if (next !== undefined && next !== background) setBackground(next, continueEdit);
  }

  return (
    <PropertySection title="Background">
      <button
        type="button"
        onClick={() => commit(addFill(background))}
        className={addButtonClass}
      >
        <Plus size={13} className="shrink-0" aria-hidden="true" />
        <span>채우기 추가</span>
      </button>

      {fills.map((fill, index) => (
        // 겹은 id가 없어 자리로 key를 단다. 이동하면 같은 자리의 칸이 다른 겹의 값을
        // 받아 다시 그려진다 — 입력칸은 값이 바뀌면 draft를 새로 맞춘다(useDraftInput).
        <FillItem
          key={index}
          fill={fill}
          index={index}
          count={fills.length}
          onCommit={commit}
          background={fills}
        />
      ))}
    </PropertySection>
  );
}

interface FillItemProps {
  fill: Fill;
  index: number;
  count: number;
  background: Background;
  onCommit: (next: Background | undefined, continueEdit?: boolean) => void;
}

/** 겹 하나 — 머리(번호·이동·삭제), 종류 선택, 종류별 칸. */
function FillItem({ fill, index, count, background, onCommit }: FillItemProps) {
  // 위가 맨 위 겹이라 번호도 위에서부터 센다.
  const label = count > 1 ? `겹 ${index + 1}${index === 0 ? " (맨 위)" : ""}` : "겹";

  return (
    <div className="flex flex-col gap-2 rounded-control border border-line p-2">
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onCommit(moveFill(background, index, "up"))}
            disabled={!canMoveFill(background, index, "up")}
            aria-label={`겹 ${index + 1} 위로`}
            title="위로"
            className={iconButtonClass}
          >
            <ArrowUp className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onCommit(moveFill(background, index, "down"))}
            disabled={!canMoveFill(background, index, "down")}
            aria-label={`겹 ${index + 1} 아래로`}
            title="아래로"
            className={iconButtonClass}
          >
            <ArrowDown className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onCommit(removeFill(background, index))}
            aria-label={`겹 ${index + 1} 삭제`}
            title="삭제"
            className={iconButtonClass}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <SegmentedControl
        label="종류"
        value={fill.type}
        options={FILL_TYPE_OPTIONS}
        onChange={(type: FillType) => onCommit(changeFillType(background, index, type))}
      />

      {fill.type === "solid" ? (
        <ColorField
          label="색"
          value={fill.color}
          onChange={(color, continueEdit) =>
            onCommit(setSolidColor(background, index, color), continueEdit)
          }
        />
      ) : (
        <LinearFillFields
          fill={fill}
          index={index}
          background={background}
          onCommit={onCommit}
        />
      )}
    </div>
  );
}

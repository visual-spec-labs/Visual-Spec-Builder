import type { Background } from "@/features/editor/schema";

import { solidBackgroundPatch, solidBackgroundView } from "./backgroundPatch";
import { PropertySection } from "./PropertySection";
import { useNodeField } from "./useNodeField";
import { ColorField } from "./fields";

/**
 * 배경 — 지금은 단색 하나만 편집한다.
 *
 * `background`를 갖는 frame · button · input이 공유한다. 예전에는
 * FrameProperties 안에만 있어 button·input은 편집할 수 없었다(#92).
 *
 * 스키마는 0.3에서 채우기 겹 배열(`Fill[]`)이 됐다(#127). 이 섹션은 그중
 * "겹이 없거나 solid 한 겹"만 색 칸으로 편집하고, 그 밖(linear 겹·여러 겹)은
 * 편집할 수 없다고 안내한다 — 판정과 쓰기는 backgroundPatch.ts. 겹 목록
 * 편집(docs/13-background-fill-design.md "Command와 패널")은 다음 단계가 이 자리를
 * 넓힌다. 섹션이 공유라 여기 한 곳만 고치면 세 타입에 다 반영된다.
 */
export function BackgroundSection() {
  const [background, setBackground] = useNodeField<Background | undefined>("background");
  const view = solidBackgroundView(background);

  // continueEdit(#121)은 그대로 넘긴다 — 안 그러면 색 칸의 타이핑 burst가
  // 병합되지 않고 키 입력마다 undo 단계가 쌓인다.
  function updateColor(color: string, continueEdit?: boolean) {
    const next = solidBackgroundPatch(background, color);
    // 같은 값이면 patch가 받은 배열을 그대로 돌려준다 — 커밋하지 않는다(#209).
    if (next !== background) setBackground(next, continueEdit);
  }

  return (
    <PropertySection title="Background">
      {view.editable ? (
        <ColorField label="배경색" value={view.color} onChange={updateColor} />
      ) : (
        <p className="text-xs text-content-muted">
          그라디언트나 여러 겹으로 된 배경은 아직 여기서 편집할 수 없습니다.
        </p>
      )}
    </PropertySection>
  );
}

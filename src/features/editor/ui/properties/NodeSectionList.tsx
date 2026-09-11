import type { NodeId } from "@/features/editor/schema";

import { BackgroundSection } from "./BackgroundSection";
import { BorderSection } from "./BorderSection";
import { ColorSection } from "./ColorSection";
import { ContentSection } from "./ContentSection";
import { EffectsSection } from "./EffectsSection";
import { LayoutSection } from "./LayoutSection";
import { hasShadow, sectionsFor, type NodeType, type SectionId } from "./nodeSections";
import { SizeSection } from "./SizeSection";
import { TypographySection } from "./TypographySection";

/**
 * 노드 타입에 맞는 속성 섹션들을 표(nodeSections.ts)대로 늘어놓는다.
 *
 * 어떤 타입이 어떤 섹션을 갖는지는 전부 그 표에 있고, 여기는 id를 컴포넌트로
 * 바꾸기만 한다. 새 섹션을 만들 때 손볼 곳은 표와 이 switch 두 군데다.
 */
function renderSection(id: SectionId, type: NodeType, selectedId: NodeId) {
  switch (id) {
    case "content":
      return <ContentSection type={type} />;
    case "layout":
      return <LayoutSection />;
    case "size":
      return <SizeSection />;
    case "typography":
      return <TypographySection />;
    case "color":
      return <ColorSection />;
    case "background":
      return <BackgroundSection />;
    case "border":
      // 노드를 바꿀 때 이 섹션만 다시 마운트한다. 모서리 모드(전체/개별)를 스펙이
      // 아니라 화면 상태로 들고 있어서(#89) 다른 노드로 따라오면 안 된다.
      //
      // 패널 전체에 key를 걸면 PropertySection들의 접힘 상태까지 매번 초기화된다 —
      // 접어 둔 섹션이 노드를 고를 때마다 도로 펼쳐진다.
      return <BorderSection key={selectedId} />;
    case "effects":
      return <EffectsSection withShadow={hasShadow(type)} />;
  }
}

export function NodeSectionList({
  type,
  selectedId,
}: {
  type: NodeType;
  selectedId: NodeId;
}) {
  return (
    <>
      {sectionsFor(type).map((id) => (
        <div key={id}>{renderSection(id, type, selectedId)}</div>
      ))}
    </>
  );
}

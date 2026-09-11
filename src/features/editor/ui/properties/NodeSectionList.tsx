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
function renderSection(id: SectionId, type: NodeType) {
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
      return <BorderSection />;
    case "effects":
      return <EffectsSection withShadow={hasShadow(type)} />;
  }
}

export function NodeSectionList({ type }: { type: NodeType }) {
  return (
    <>
      {sectionsFor(type).map((id) => (
        <div key={id}>{renderSection(id, type)}</div>
      ))}
    </>
  );
}

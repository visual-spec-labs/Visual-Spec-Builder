import { FeatureCard1 } from "./FeatureCard1";

export function Features() {
  return (
    <>
      <style>{`
.vsb-real-flow-page-1-features {
  display: flex; flex-direction: column; box-sizing: border-box;
  justify-content: flex-start; align-items: stretch;
  gap: 16px; padding: 32px 24px 32px 24px;
  align-self: stretch; width: auto; height: auto; flex: 0 0 auto; min-height: 0;
}
@media (min-width: 768px) {
  .vsb-real-flow-page-1-features { flex-direction: row; }
}
@media (min-width: 1024px) {
  .vsb-real-flow-page-1-features { padding-left: 64px; padding-right: 64px; }
}`}</style>
      <div data-node-id="features" className="vsb-real-flow-page-1-features">
        <FeatureCard1
          nodeId="featureCard1"
          titleNodeId="featureTitle1"
          title="자동 레이아웃"
          descriptionNodeId="featureDesc1"
          description="Auto Layout 규칙으로 화면 구조를 일관되게 잡습니다."
        />
        <FeatureCard1
          nodeId="featureCard2"
          titleNodeId="featureTitle2"
          title="반응형 분기점"
          descriptionNodeId="featureDesc2"
          description="폭별 차이만 덮어써 하나의 스펙으로 여러 화면을 다룹니다."
        />
        <FeatureCard1
          nodeId="featureCard3"
          titleNodeId="featureTitle3"
          title="코드로 바로 연결"
          descriptionNodeId="featureDesc3"
          description="확정한 스펙을 React·Tailwind 코드로 옮깁니다."
        />
      </div>
    </>
  );
}

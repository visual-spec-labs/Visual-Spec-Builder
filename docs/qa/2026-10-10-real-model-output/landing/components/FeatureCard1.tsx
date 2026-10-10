interface FeatureCard1Props {
  nodeId: string;
  titleNodeId: string;
  title: string;
  descriptionNodeId: string;
  description: string;
}

export function FeatureCard1({ nodeId, titleNodeId, title, descriptionNodeId, description }: FeatureCard1Props) {
  return (
    <>
      <style>{`
.vsb-real-flow-page-1-feature-card {
  display: flex; flex-direction: column; box-sizing: border-box;
  justify-content: flex-start; align-items: stretch;
  gap: 8px; padding: 20px 20px 20px 20px;
  background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px;
  align-self: stretch; width: auto; height: auto; flex: 0 0 auto; min-height: 0;
}
@media (min-width: 768px) {
  .vsb-real-flow-page-1-feature-card { align-self: auto; flex: 1 1 0; min-width: 0; min-height: auto; }
}`}</style>
      <div data-node-id={nodeId} className="vsb-real-flow-page-1-feature-card">
        <p data-node-id={titleNodeId} className="self-stretch h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#111111] [font-family:'Pretendard'] text-[18px] font-semibold leading-[26px] tracking-[0px] text-left">{title}</p>
        <p data-node-id={descriptionNodeId} className="self-stretch h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#4B5563] [font-family:'Pretendard'] text-[14px] font-normal leading-[22px] tracking-[0px] text-left">{description}</p>
      </div>
    </>
  );
}

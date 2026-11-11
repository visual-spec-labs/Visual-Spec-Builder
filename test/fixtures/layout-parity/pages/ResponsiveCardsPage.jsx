// examples/responsive-cards.json. root 클래스는 test/fixtures/responsive-codegen.ts의
// #224 fixture와 같다(layout-parity-fixture.test.ts가 확인).
import { PageShell } from "../PageShell";

export const rootClasses = "flex flex-row items-start gap-[24px] pt-[48px] pr-[48px] pb-[48px] pl-[48px] bg-[#F1F5F9] w-full flex-[1_0_auto] min-[768px]:pl-[32px] min-[1024px]:gap-[32px] min-[1024px]:bg-transparent min-[1024px]:bg-none min-[1024px]:[background-origin:padding-box]";

const card = "flex flex-col gap-[8px] pt-[20px] pr-[20px] pb-[20px] pl-[20px] justify-start items-start bg-[#FFFFFF] flex-[1_1_0] min-w-0 h-[180px]";
const title = "self-stretch h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#0F172A] [font-family:'Pretendard'] text-[18px] font-semibold leading-[26px] tracking-[0px] text-left";

export default function ResponsiveCardsPage({ visibility = false }) {
  return (
    <PageShell width="100%" height="900px">
      <div data-node-id="root" className={rootClasses}>
        <div data-node-id="elevatedCard" className={`${card} border-[0px] border-[#00000000] rounded-[12px] shadow-[0px_8px_24px_-4px_#0F172A26]`}>
          <p data-node-id="elevatedTitle" className={title}><span><strong className="font-semibold">그림자</strong></span></p>
        </div>
        <div data-node-id="outlinedCard" className={`${card} rounded-[20px_20px_4px_4px] shadow-[0_0_0_2px_#6366F1]`}>
          <p data-node-id="outlinedTitle" className={title}>바깥 테두리 · 모서리별</p>
        </div>
        <div data-node-id="fadedCard" className={`${card} ${visibility ? "min-[768px]:hidden min-[1024px]:flex" : ""} border-[1px] border-[#E2E8F0] rounded-[12px] opacity-[0.5] blur-[2px]`}>
          <p data-node-id="fadedTitle" className={`${title} opacity-[0.8]`}>투명도 · 블러</p>
        </div>
      </div>
    </PageShell>
  );
}

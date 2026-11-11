// examples/two-page-project.json의 dashboard 페이지. 스킬의 분리 생성 예제처럼 Card를 반복 컴포넌트로 뽑았다.
import { PageShell } from "../PageShell";

function Card({ id, label, value }) {
  return (
    <div data-node-id={id} className="flex flex-col gap-[8px] pt-[20px] pr-[20px] pb-[20px] pl-[20px] justify-start items-start bg-[#FFFFFF] border-[1px] border-[#E5E7EB] rounded-[12px] flex-[1_1_0] min-w-0 h-auto">
      <p data-node-id={`${id}Label`} className="w-auto h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#6B7280] [font-family:'Pretendard'] text-[13px] font-medium leading-[18px] tracking-[0px] text-left">{label}</p>
      <p data-node-id={`${id}Value`} className="w-auto h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#111111] [font-family:'Pretendard'] text-[28px] font-bold leading-[36px] tracking-[-0.4px] text-left">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PageShell width="1440px" height="900px">
      <div data-node-id="root" className="flex flex-col gap-[24px] pt-[32px] pr-[32px] pb-[32px] pl-[32px] justify-start items-stretch bg-[#F7F8FA] w-full flex-[1_0_auto]">
        <div data-node-id="header" className="flex flex-col gap-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] justify-start items-start self-stretch h-auto flex-[0_0_auto] min-h-0">
          <p data-node-id="headerTitle" className="w-auto h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#111111] [font-family:'Pretendard'] text-[28px] font-bold leading-[36px] tracking-[-0.6px] text-left">대시보드</p>
        </div>
        <div data-node-id="content" className="flex flex-row gap-[16px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] justify-start items-stretch self-stretch h-auto flex-[0_0_auto] min-h-0">
          <Card id="cardA" label="총 방문자" value="12,480" />
          <Card id="cardB" label="전환율" value="3.7%" />
        </div>
      </div>
    </PageShell>
  );
}

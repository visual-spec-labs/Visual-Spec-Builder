import heroImageUrl from "../assets/hero.png";
import { PageShell } from "../PageShell";

export default function ImageHeroPage() {
  return (
    <PageShell width="390px" height="844px">
      <div data-node-id="root" className="flex flex-col gap-[16px] pt-[0px] pr-[0px] pb-[24px] pl-[0px] justify-start items-stretch bg-[#FFFFFF] w-full flex-[1_0_auto]">
        <img
          data-node-id="hero"
          src={heroImageUrl}
          alt=""
          className="self-stretch h-[240px] flex-[0_0_240px] shrink-0 object-cover"
        />
        <p data-node-id="caption" className="self-stretch h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#374151] [font-family:'Pretendard'] text-[14px] font-normal leading-[20px] tracking-[0px] text-left">가져온 이미지 위에 설명 텍스트를 배치한다.</p>
      </div>
    </PageShell>
  );
}

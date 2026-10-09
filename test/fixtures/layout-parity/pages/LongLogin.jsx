// 로그인 아래 긴 약관 텍스트와 520px 배너를 더한 긴 페이지. 스펙은 layout-parity.mjs가 만든다.
// 스펙의 promo는 visible:false라 스킬 규칙대로 내보내지 않는다.
import { PageShell } from "../PageShell";
import { LoginCard, loginRootClasses, Title } from "./LoginParts";

export default function LongLogin() {
  return (
    <PageShell width="390px" height="844px">
      <div data-node-id="root" className={`${loginRootClasses} w-full flex-[1_0_auto]`}>
        <Title />
        <LoginCard />
        <p data-node-id="terms" className="self-stretch h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#4B5563] [font-family:'Pretendard'] text-[14px] font-normal leading-[22px] tracking-[0px] text-left">이용약관에 동의하면 계정을 만들 수 있습니다. 개인정보는 서비스 제공과 보안 확인에만 사용하며, 동의 없이 제3자에게 제공하지 않습니다. 자세한 내용은 고객센터에서 언제든지 확인할 수 있습니다.</p>
        <div data-node-id="banner" className="flex flex-col gap-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] justify-start items-stretch bg-[#E0E7FF] self-stretch h-[520px] flex-[0_0_520px] shrink-0 min-h-0" />
      </div>
    </PageShell>
  );
}

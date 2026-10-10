import { EmailInput } from "./EmailInput";

export function Content() {
  return (
    <div data-node-id="content" className="flex flex-col gap-[16px] pt-[24px] pr-[24px] pb-[24px] pl-[24px] justify-start items-stretch self-stretch h-auto flex-[0_0_auto] min-h-0">
      <p data-node-id="title" className="self-stretch h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#111111] [font-family:'Pretendard'] text-[24px] font-bold leading-[32px] tracking-[-0.5px] text-left">팀 공간에 로그인</p>
      <EmailInput nodeId="emailInput" placeholder="이메일을 입력하세요" />
      <EmailInput nodeId="passwordInput" placeholder="비밀번호를 입력하세요" />
      <button data-node-id="loginButton" type="button" className="flex items-center justify-center self-stretch h-[44px] flex-[0_0_44px] shrink-0 min-h-0 text-[#FFFFFF] [font-family:'Pretendard'] text-[14px] font-semibold leading-[20px] tracking-[0px] text-center bg-[#4F46E5] border-[0px] border-[#4F46E5] rounded-[8px]">계속하기</button>
    </div>
  );
}

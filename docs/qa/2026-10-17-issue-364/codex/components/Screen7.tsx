import { Screen5 } from "./Screen5";
import { Screen6 } from "./Screen6";

export function Screen7() {
  return (
    <div data-node-id="loginForm" className="flex flex-col gap-[10px] pt-[8px] pr-[0px] pb-[8px] pl-[0px] justify-start items-stretch self-stretch h-auto flex-[0_0_auto] min-h-0">
      <Screen5 nodeId="emailLabel" text="이메일" />
      <Screen6 nodeId="emailInput" placeholder="이메일을 입력하세요" />
      <Screen5 nodeId="passwordLabel" text="비밀번호" />
      <Screen6 nodeId="passwordInput" placeholder="비밀번호를 입력하세요" />
      <button data-node-id="loginButton" type="button" className="flex items-center justify-center self-stretch h-[50px] flex-[0_0_50px] shrink-0 text-[#FFFFFF] [font-family:'Pretendard'] text-[16px] font-semibold leading-[22px] tracking-[0px] text-center bg-[#4F46E5] border-[0px] border-[#4F46E5] rounded-[10px]">로그인</button>
    </div>
  );
}

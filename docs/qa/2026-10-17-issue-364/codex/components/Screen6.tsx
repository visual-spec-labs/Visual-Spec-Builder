type Screen6Props = {
  nodeId: "emailInput" | "passwordInput";
  placeholder: "이메일을 입력하세요" | "비밀번호를 입력하세요";
};

export function Screen6({ nodeId, placeholder }: Screen6Props) {
  return (
    <input data-node-id={nodeId} placeholder={placeholder} className="flex items-center self-stretch h-[48px] flex-[0_0_48px] shrink-0 placeholder:text-current placeholder:opacity-[0.6] text-[#111827] [font-family:'Pretendard'] text-[14px] font-normal leading-[20px] tracking-[0px] text-left bg-[#F9FAFB] border-[1px] border-[#D1D5DB] rounded-[10px]" />
  );
}
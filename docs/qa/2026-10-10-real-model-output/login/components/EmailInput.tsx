interface EmailInputProps {
  nodeId: string;
  placeholder: string;
}

export function EmailInput({ nodeId, placeholder }: EmailInputProps) {
  return (
    <input
      data-node-id={nodeId}
      placeholder={placeholder}
      className="flex items-center self-stretch h-[44px] flex-[0_0_44px] shrink-0 min-h-0 placeholder:text-current placeholder:opacity-[0.6] text-[#111827] [font-family:'Pretendard'] text-[14px] font-normal leading-[20px] tracking-[0px] text-left bg-[#F9FAFB] border-[1px] border-[#D1D5DB] rounded-[8px]"
    />
  );
}

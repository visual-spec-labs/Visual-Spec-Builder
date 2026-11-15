// 라벨 + 입력창 필드. 8개 인스턴스(nameField~birthDateField)가 구조·스타일이 같고
// 노드 ID·라벨·placeholder만 다르므로 그 차이를 props로 받는다.
interface NameFieldProps {
  nodeId: string;
  labelNodeId: string;
  inputNodeId: string;
  label: string;
  placeholder: string;
}

export function NameField({ nodeId, labelNodeId, inputNodeId, label, placeholder }: NameFieldProps) {
  return (
    <div data-node-id={nodeId} className="flex flex-col gap-[8px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] justify-start items-stretch self-stretch h-auto flex-[0_0_auto] min-h-0">
      <p data-node-id={labelNodeId} className="self-stretch h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#374151] [font-family:'Pretendard'] text-[14px] font-semibold leading-[20px] tracking-[0px] text-left">{label}</p>
      <input
        data-node-id={inputNodeId}
        placeholder={placeholder}
        className="flex items-center self-stretch h-[52px] flex-[0_0_52px] shrink-0 min-h-0 placeholder:text-current placeholder:opacity-[0.6] text-[#111827] [font-family:'Pretendard'] text-[14px] font-normal leading-[20px] tracking-[0px] text-left bg-[#F9FAFB] border-[1px] border-[#D1D5DB] rounded-[8px]"
      />
    </div>
  );
}

type Screen5Props = {
  nodeId: "emailLabel" | "passwordLabel";
  text: "이메일" | "비밀번호";
};

export function Screen5({ nodeId, text }: Screen5Props) {
  return (
    <p data-node-id={nodeId} className="self-stretch h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#374151] [font-family:'Pretendard'] text-[14px] font-semibold leading-[20px] tracking-[0px] text-left">{text}</p>
  );
}
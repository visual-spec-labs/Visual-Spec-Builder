// examples/login-screen.json 노드를 스킬 매핑표대로 옮긴 fixture 컴포넌트.
// 입력창 두 개는 같은 구조라 스킬 예제처럼 placeholder를 prop으로 받는다.
export const loginRootClasses = "flex flex-col gap-[16px] pt-[24px] pr-[20px] pb-[24px] pl-[20px] justify-start items-stretch bg-[#FFFFFF]";

export function Title() {
  return <p data-node-id="title" className="self-stretch h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#111111] [font-family:'Pretendard'] text-[24px] font-bold leading-[32px] tracking-[-0.5px] text-left">로그인</p>;
}

export function Hint() {
  return <p data-node-id="hint" className="w-auto h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#666666] [font-family:'Pretendard'] text-[14px] font-normal leading-[20px] tracking-[0px] text-center">계정 정보를 입력하세요</p>;
}

export const cardClasses = "flex flex-col gap-[12px] pt-[16px] pr-[16px] pb-[16px] pl-[16px] justify-center items-stretch bg-[#F5F5F5FF] border-[1px] border-[#00000020] rounded-[8px] self-stretch h-auto flex-[0_0_auto] min-h-0";

function TextInput({ id, placeholder }) {
  return (
    <input
      data-node-id={id}
      placeholder={placeholder}
      className="self-stretch h-[44px] flex-[0_0_44px] shrink-0 min-h-0 flex items-center placeholder:text-current placeholder:opacity-[0.6] text-[#111827] [font-family:'Pretendard'] text-[14px] font-normal leading-[20px] tracking-[0px] text-left bg-[#F9FAFB] border-[1px] border-[#D1D5DB] rounded-[8px]"
    />
  );
}

export function LoginCard() {
  return (
    <div data-node-id="card" className={cardClasses}>
      <Hint />
      <TextInput id="emailInput" placeholder="이메일을 입력하세요" />
      <TextInput id="passwordInput" placeholder="비밀번호를 입력하세요" />
      <button data-node-id="loginButton" type="button" className="self-stretch h-[44px] flex-[0_0_44px] shrink-0 min-h-0 flex items-center justify-center text-[#FFFFFF] [font-family:'Pretendard'] text-[14px] font-semibold leading-[20px] tracking-[0px] text-center bg-[#4F46E5] border-[0px] border-[#4F46E5] rounded-[8px]">로그인</button>
    </div>
  );
}

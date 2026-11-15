import { NameField } from "./NameField";

// 입력 필드 8개(nameField~birthDateField)는 구조·스타일이 같아 공유 NameField에 노드 ID·라벨·placeholder만 넘긴다.
export function Form() {
  return (
    <div data-node-id="form" className="flex flex-col gap-[28px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] justify-start items-stretch self-stretch h-auto flex-[0_0_auto] min-h-0">
      <NameField nodeId="nameField" labelNodeId="nameLabel" inputNodeId="nameInput" label="이름" placeholder="이름을 입력하세요" />
      <NameField nodeId="emailField" labelNodeId="emailLabel" inputNodeId="emailInput" label="이메일" placeholder="example@email.com" />
      <NameField nodeId="phoneField" labelNodeId="phoneLabel" inputNodeId="phoneInput" label="전화번호" placeholder="010-0000-0000" />
      <NameField nodeId="passwordField" labelNodeId="passwordLabel" inputNodeId="passwordInput" label="비밀번호" placeholder="8자 이상 입력하세요" />
      <NameField nodeId="passwordConfirmField" labelNodeId="passwordConfirmLabel" inputNodeId="passwordConfirmInput" label="비밀번호 확인" placeholder="비밀번호를 다시 입력하세요" />
      <NameField nodeId="addressField" labelNodeId="addressLabel" inputNodeId="addressInput" label="주소" placeholder="주소를 입력하세요" />
      <NameField nodeId="addressDetailField" labelNodeId="addressDetailLabel" inputNodeId="addressDetailInput" label="상세 주소" placeholder="동·호수 등 상세 주소를 입력하세요" />
      <NameField nodeId="birthDateField" labelNodeId="birthDateLabel" inputNodeId="birthDateInput" label="생년월일" placeholder="YYYY-MM-DD" />
    </div>
  );
}

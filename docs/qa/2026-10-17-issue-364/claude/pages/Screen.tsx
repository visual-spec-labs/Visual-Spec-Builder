import { Title } from "../components/Title";
import { Intro } from "../components/Intro";
import { Form } from "../components/Form";
import { PrivacyNotice } from "../components/PrivacyNotice";
import { SignupButton } from "../components/SignupButton";

// root의 직계 자식 5개는 이전 웨이브에서 확정된 컴포넌트를 그대로 조합한다.
export default function Screen() {
  return (
    <>
      <style>{`
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css");
html, body, #root { width: 100%; min-height: 100%; margin: 0; }
@layer base {
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; border: 0 solid; }
  button, input { font: inherit; letter-spacing: inherit; color: inherit; }
  ::placeholder { color: currentColor; opacity: .6; }
}
.vsb-page { display: flex; flex-direction: column; width: var(--vsb-page-width);
  min-height: var(--vsb-page-height); margin-inline: auto; }
`}</style>
      <main className="vsb-page" style={{
        "--vsb-page-width": "390px", "--vsb-page-height": "844px",
      } as React.CSSProperties}>
        <div data-node-id="root" className="flex flex-col gap-[32px] pt-[56px] pr-[20px] pb-[56px] pl-[20px] justify-start items-stretch bg-[#FFFFFF] w-full flex-[1_0_auto]">
          <Title />
          <Intro />
          <Form />
          <PrivacyNotice />
          <SignupButton />
        </div>
      </main>
    </>
  );
}

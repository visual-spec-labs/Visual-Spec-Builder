import { Hero } from "../components/Hero";
import { Content } from "../components/Content";

export default function Login() {
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
        <div data-node-id="root" className="flex flex-col gap-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] justify-start items-stretch bg-[#FFFFFF] w-full flex-[1_0_auto]">
          <Hero />
          <Content />
        </div>
      </main>
    </>
  );
}

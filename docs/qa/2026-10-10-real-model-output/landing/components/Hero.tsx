import heroImageUrl from "../assets/hero.png";

export function Hero() {
  return (
    <>
      <style>{`
.vsb-real-flow-page-1-hero {
  display: flex; flex-direction: column; box-sizing: border-box;
  justify-content: center; align-items: flex-start;
  gap: 0px; padding: 24px 24px 24px 24px;
  align-self: stretch; height: 320px; flex: 0 0 320px; min-height: 0;
  background-image: url(${JSON.stringify(heroImageUrl)}); background-size: cover;
  background-position: center; background-repeat: no-repeat; background-origin: border-box;
}
@media (min-width: 1024px) {
  .vsb-real-flow-page-1-hero { padding-left: 64px; padding-right: 64px; }
}`}</style>
      <div data-node-id="hero" className="vsb-real-flow-page-1-hero">
        <p data-node-id="heroTitle" className="self-stretch h-auto flex-[0_0_auto] min-h-0 whitespace-pre-wrap m-0 text-[#FFFFFF] [font-family:'Pretendard'] text-[40px] font-bold leading-[52px] tracking-[-0.5px] text-left">화면 설계를 코드까지 한 번에</p>
      </div>
    </>
  );
}

import heroImageUrl from "../assets/hero.png";

export function Screen2() {
  return (
    <img data-node-id="heroImage" src={heroImageUrl} alt="" className="self-stretch h-[152px] flex-[0_0_152px] shrink-0 object-cover" />
  );
}
import heroImageUrl from "../assets/hero.png";

export function Hero() {
  return (
    <img
      data-node-id="hero"
      src={heroImageUrl}
      alt=""
      className="self-stretch h-[200px] flex-[0_0_200px] shrink-0 min-h-0 object-cover"
    />
  );
}

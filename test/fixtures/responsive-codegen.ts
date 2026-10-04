import type { Background, VisualSpec } from "@/features/editor/schema";
import responsiveCards from "../../examples/responsive-cards.json";

/** #224 스킬을 사람이 옮긴 검증 fixture다. 제품 변환기나 AI 생성 결과가 아니다. */
export const responsiveCardsClasses = "flex flex-row gap-[24px] pt-[48px] pr-[48px] pb-[48px] pl-[48px] bg-[#F1F5F9] w-full h-full min-[768px]:pl-[32px] min-[1024px]:gap-[32px] min-[1024px]:bg-transparent min-[1024px]:bg-none min-[1024px]:[background-origin:padding-box]";

const gradient: Background = [{ type: "linear", angle: 90, stops: [{ at: 0, color: "#FF000000" }, { at: 1, color: "#FF000080" }] }];

export const backgroundCases: {
  name: string;
  base: Background;
  tablet: Background;
  desktop: Background;
  classes: string;
}[] = [
  {
    name: "layers-solid-empty",
    base: [...gradient, { type: "solid", color: "#00FF00" }],
    tablet: [{ type: "solid", color: "#0000FF80" }],
    desktop: [],
    classes: "bg-[#00FF00] bg-[image:linear-gradient(90deg,_#FF000000_0%,_#FF000080_100%)] bg-origin-border min-[768px]:bg-[#0000FF80] min-[768px]:bg-none min-[768px]:[background-origin:padding-box] min-[1024px]:bg-transparent min-[1024px]:bg-none min-[1024px]:[background-origin:padding-box]",
  },
  {
    name: "solid-image-layers",
    base: [{ type: "solid", color: "#00FF00" }],
    tablet: gradient,
    desktop: [{ type: "solid", color: "#FFFFFF33" }, ...gradient],
    classes: "bg-[#00FF00] min-[768px]:bg-transparent min-[768px]:bg-[image:linear-gradient(90deg,_#FF000000_0%,_#FF000080_100%)] min-[768px]:bg-origin-border min-[1024px]:bg-transparent min-[1024px]:bg-[image:linear-gradient(#FFFFFF33,_#FFFFFF33),_linear-gradient(90deg,_#FF000000_0%,_#FF000080_100%)] min-[1024px]:bg-origin-border",
  },
];

export function backgroundSpec(index: number): VisualSpec {
  const spec = structuredClone(responsiveCards) as VisualSpec;
  const item = backgroundCases[index];
  const root = spec.screen.nodes.root;
  if (root.type !== "frame") throw new Error("fixture root must be a frame");
  root.background = item.base;
  spec.screen.responsive!.overrides.tablet.root = { ...spec.screen.responsive!.overrides.tablet.root, background: item.tablet };
  spec.screen.responsive!.overrides.desktop.root = { ...spec.screen.responsive!.overrides.desktop.root, background: item.desktop };
  return spec;
}

// 제공된 대상 설정이 md=960px인 예. IR tablet=768px를 md라는 이름으로 추측하면 틀린다.
export const mismatchedNamedVariant = "md:gap-[96px] min-[768px]:pl-[32px]";

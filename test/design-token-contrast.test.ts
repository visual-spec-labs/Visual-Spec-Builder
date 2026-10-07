import { describe, expect, it } from "vitest";

/**
 * `src/styles/tokens`의 컬러 토큰은 CSS 커스텀 프로퍼티라 vitest(jsdom 없이 실행)가
 * 실제 값을 읽을 방법이 없다 — 그래서 원시값을 이 파일에 그대로 옮겨 적고 WCAG
 * 대비 공식으로 계산한다(#276). `semantic/colors.css`·`primitives/colors.css`의
 * 값이 바뀌면 아래 상수도 같이 고쳐야 한다 — 그러지 않으면 이 테스트가 틀린
 * 값으로 "통과"를 거짓 보고한다.
 *
 * 흰·회색 계열(oklch 채도 0)만 다루므로 변환식이 단순하다 — OKLab에서 a=b=0이면
 * L,M,S 세 원뿔 반응이 전부 L과 같아지고(= l_=m_=s_=L), 그 결과 선형 sRGB의
 * R=G=B=L³이 된다(Björn Ottosson의 OKLab 역행렬이 계수 합이 1이 되도록 짜여
 * 있어 채도 0일 때 항등식으로 접힌다). 거기에 표준 sRGB 감마 인코딩만 적용하면
 * 16진 값이 나온다.
 */
function oklchGrayToHex(lightnessPercent: number): string {
  const x = (lightnessPercent / 100) ** 3;
  const gamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  const byte = Math.round(Math.min(1, Math.max(0, gamma(x))) * 255);
  const hex = byte.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16)) as [number, number, number];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** WCAG 2.x 대비비(1:1 ~ 21:1). */
function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA — 일반 크기 텍스트. */
const AA_NORMAL_TEXT = 4.5;

// primitives/colors.css 그대로.
const NEUTRAL_400 = oklchGrayToHex(70.8); // --color-neutral-400 (content-subtle, 라이트)
const NEUTRAL_600 = oklchGrayToHex(43.9); // --color-neutral-600 (content-muted, 라이트)
const GRAY_400 = "#a9aab0"; // --color-gray-400 (content-muted, 다크)
const GRAY_600 = "#6b6c72"; // --color-gray-600 (content-subtle, 다크)

// semantic/colors.css의 다섯 surface 역할. 라이트는 neutral-*, 다크는 gray-*.
const LIGHT_SURFACES = {
  surface: "#ffffff",
  "surface-sunken": oklchGrayToHex(97), // neutral-100
  "surface-canvas": oklchGrayToHex(92.2), // neutral-200
  "surface-raised": "#ffffff",
  "surface-inset": oklchGrayToHex(97), // neutral-100
};
const DARK_SURFACES = {
  surface: "#26272c", // gray-900
  "surface-sunken": "#191a1d", // gray-975
  "surface-canvas": "#141518", // gray-1000
  "surface-raised": "#2c2d33", // gray-850
  "surface-inset": "#1c1e22", // gray-950
};

describe("design token contrast — content-muted는 다섯 surface 전부에서 AA를 넘는다(#276)", () => {
  it.each(Object.entries(LIGHT_SURFACES))(
    "라이트: content-muted on bg-%s",
    (_name, surfaceHex) => {
      expect(contrastRatio(NEUTRAL_600, surfaceHex)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    },
  );

  it.each(Object.entries(DARK_SURFACES))("다크: content-muted on bg-%s", (_name, surfaceHex) => {
    expect(contrastRatio(GRAY_400, surfaceHex)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

describe("design token contrast — content-subtle은 disabled/장식 전용이라 AA 대상이 아니다(#276)", () => {
  it("라이트 bg-surface 기준 대비가 AA 밑이다 — 일반 텍스트에 쓰면 안 된다는 뜻을 수치로 고정", () => {
    expect(contrastRatio(NEUTRAL_400, "#ffffff")).toBeLessThan(AA_NORMAL_TEXT);
  });

  it("다크 bg-surface 기준 대비가 AA 밑이다", () => {
    expect(contrastRatio(GRAY_600, "#26272c")).toBeLessThan(AA_NORMAL_TEXT);
  });
});

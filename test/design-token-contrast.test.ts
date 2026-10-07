import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * `primitives/colors.css`·`semantic/colors.css`를 **직접 읽어서** 대비를
 * 계산한다(#276 리뷰 대응). 처음 버전은 값을 테스트 파일 안에 복사해 뒀는데,
 * 그러면 production의 `--content-muted` 연결을 예전 값으로 되돌리거나
 * `--color-neutral-600`을 지워도 테스트가 계속 통과하는 — 실제로는 아무것도
 * 지키지 못하는 — 회귀 테스트가 된다. 커밋된 두 CSS 파일을 매번 파싱해서
 * 쓰므로, 토큰 값이나 연결이 바뀌면 이 테스트도 같이 움직인다.
 *
 * 흰·회색 계열(oklch 채도 0)만 다루므로 변환식이 단순하다 — OKLab에서 a=b=0이면
 * L,M,S 세 원뿔 반응이 전부 L과 같아지고(= l_=m_=s_=L), 그 결과 선형 sRGB의
 * R=G=B=L³이 된다(Björn Ottosson의 OKLab 역행렬이 계수 합이 1이 되도록 짜여
 * 있어 채도 0일 때 항등식으로 접힌다). 거기에 표준 sRGB 감마 인코딩만 적용하면
 * 16진 값이 나온다. 채도가 0이 아닌 primitive(oklch(... C>0 ...))나 hex/oklch가
 * 아닌 형식이 surface·content 체인에 섞여 들어오면 `resolvePrimitive`가 곧장
 * 던진다 — 조용히 잘못된 값으로 "통과"하지 않는다.
 */

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRIMITIVES_PATH = resolve(projectRoot, "src/styles/tokens/primitives/colors.css");
const SEMANTIC_PATH = resolve(projectRoot, "src/styles/tokens/semantic/colors.css");

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

/**
 * `selector`의 첫 번째 블록(`selector { ... }`) 안쪽 텍스트를 돌려준다.
 * 이 저장소의 토큰 CSS는 선언부 안에 중괄호가 중첩되지 않으므로(값이
 * hex/oklch()/rgba()/var() 뿐) 짝 맞추기 없이 첫 `}` 까지만 잘라도 된다.
 */
function extractBlock(css: string, selector: RegExp): string {
  const match = selector.exec(css);
  if (match === null) throw new Error(`블록을 찾지 못함: ${selector}`);
  const start = match.index + match[0].length;
  const end = css.indexOf("}", start);
  if (end === -1) throw new Error(`${selector} 블록의 닫는 } 를 찾지 못함`);
  return css.slice(start, end);
}

/** `--name: value;` 선언을 전부 모아 `name → value` 로 돌려준다. */
function parseDeclarations(block: string): Map<string, string> {
  const declarations = new Map<string, string>();
  const re = /--([\w-]+):\s*([^;]+);/g;
  for (const match of block.matchAll(re)) {
    declarations.set(match[1], match[2].trim());
  }
  return declarations;
}

/** Primitive 선언값(`#hex` 또는 무채색 `oklch(L% 0 none)`)을 hex로 바꾼다. */
function resolvePrimitive(raw: string): string {
  if (raw.startsWith("#")) return raw.toLowerCase();
  const oklch = /^oklch\(\s*([\d.]+)%\s+0\s+none\s*\)$/.exec(raw);
  if (oklch !== null) return oklchGrayToHex(Number(oklch[1]));
  throw new Error(`지원하지 않는 primitive 형식(hex/무채색 oklch만 처리): ${raw}`);
}

/** Semantic 선언값(`var(--color-X)`)을 Primitive 맵에서 찾아 hex로 바꾼다. */
function resolveSemanticVar(raw: string, primitives: Map<string, string>): string {
  const varRef = /^var\(--(color-[\w-]+)\)$/.exec(raw);
  if (varRef === null) throw new Error(`var(--color-*) 참조가 아님: ${raw}`);
  const primitiveRaw = primitives.get(varRef[1]);
  if (primitiveRaw === undefined) throw new Error(`primitive를 찾지 못함: --${varRef[1]}`);
  return resolvePrimitive(primitiveRaw);
}

const SURFACE_ROLES = [
  "surface",
  "surface-sunken",
  "surface-canvas",
  "surface-raised",
  "surface-inset",
] as const;

function readSurfaces(vars: Map<string, string>, primitives: Map<string, string>) {
  return Object.fromEntries(
    SURFACE_ROLES.map((role) => {
      const raw = vars.get(role);
      if (raw === undefined) throw new Error(`surface 역할을 찾지 못함: --${role}`);
      return [role, resolveSemanticVar(raw, primitives)];
    }),
  ) as Record<(typeof SURFACE_ROLES)[number], string>;
}

function readContentRole(vars: Map<string, string>, primitives: Map<string, string>, role: string) {
  const raw = vars.get(role);
  if (raw === undefined) throw new Error(`content 역할을 찾지 못함: --${role}`);
  return resolveSemanticVar(raw, primitives);
}

const primitives = parseDeclarations(extractBlock(readFileSync(PRIMITIVES_PATH, "utf8"), /:root\s*\{/));

const semanticCss = readFileSync(SEMANTIC_PATH, "utf8");
const lightVars = parseDeclarations(extractBlock(semanticCss, /:root\s*\{/));
const darkVars = parseDeclarations(extractBlock(semanticCss, /\[data-theme="dark"\]\s*\{/));

const lightSurfaces = readSurfaces(lightVars, primitives);
const darkSurfaces = readSurfaces(darkVars, primitives);

const lightContentMuted = readContentRole(lightVars, primitives, "content-muted");
const darkContentMuted = readContentRole(darkVars, primitives, "content-muted");
const lightContentSubtle = readContentRole(lightVars, primitives, "content-subtle");
const darkContentSubtle = readContentRole(darkVars, primitives, "content-subtle");

describe("design token contrast — content-muted는 다섯 surface 전부에서 AA를 넘는다(#276)", () => {
  it.each(Object.entries(lightSurfaces))("라이트: content-muted on bg-%s", (_name, surfaceHex) => {
    expect(contrastRatio(lightContentMuted, surfaceHex)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it.each(Object.entries(darkSurfaces))("다크: content-muted on bg-%s", (_name, surfaceHex) => {
    expect(contrastRatio(darkContentMuted, surfaceHex)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

describe("design token contrast — content-subtle은 disabled/장식 전용이라 AA 대상이 아니다(#276)", () => {
  it("라이트 bg-surface 기준 대비가 AA 밑이다 — 일반 텍스트에 쓰면 안 된다는 뜻을 수치로 고정", () => {
    expect(contrastRatio(lightContentSubtle, lightSurfaces.surface)).toBeLessThan(AA_NORMAL_TEXT);
  });

  it("다크 bg-surface 기준 대비가 AA 밑이다", () => {
    expect(contrastRatio(darkContentSubtle, darkSurfaces.surface)).toBeLessThan(AA_NORMAL_TEXT);
  });
});

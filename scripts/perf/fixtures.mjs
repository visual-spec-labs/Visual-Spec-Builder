// 성능 실측(#293)용 작업공간 픽스처를 만든다. 측정 스크립트(measure.mjs)가 부른다.
//
// 프로젝트 문서(0.3)를 `count`개, 각 페이지의 노드를 정확히 `nodes`개로 만든다. 노드 구성은
// 실제 화면과 비슷하게 root → 섹션(frame) → 카드(frame row) → text·button·input이다. 이미지
// 시나리오는 큰 PNG 하나를 assets/에 두고 모든 프로젝트가 image 노드로 참조한다(`distinct`면 프로젝트마다
// 다른 PNG — 디코딩·비트맵 메모리를 프로젝트 수만큼 쓰게 한다, #318).
// 만든 문서는 CLI와 같은 검증기(bin/lib/schema.mjs)로 확인한다 — 잘못된 픽스처로 재지 않게.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

import { validateProjectSpec } from "../../bin/lib/schema.mjs";

const typography = (fontWeight = 400, textAlign = "left") => ({
  fontFamily: "Pretendard", fontSize: 14, fontWeight, lineHeight: 20, letterSpacing: 0, textAlign,
});
const frame = (name, direction, children) => ({
  type: "frame", name, box: { width: "fill", height: "auto" },
  layout: { direction, gap: 8, padding: { top: 8, right: 8, bottom: 8, left: 8 }, mainAxis: "start", crossAxis: "stretch" },
  background: [{ type: "solid", color: "#FFFFFF" }],
  border: { width: 1, color: "#E5E7EB", radius: 8 },
  children: children.map((node) => ({ node })),
});
const text = (name, content) => ({
  type: "text", name, box: { width: "fill", height: "auto" }, content, color: "#111827", typography: typography(),
});
const button = (name) => ({
  type: "button", name, box: { width: 120, height: 36 }, content: "확인", color: "#FFFFFF",
  typography: typography(600, "center"), background: [{ type: "solid", color: "#4F46E5" }],
  border: { width: 0, color: "#4F46E5", radius: 8 },
});
const input = (name) => ({
  type: "input", name, box: { width: "fill", height: 36 }, placeholder: "입력하세요", color: "#111827",
  typography: typography(), background: [{ type: "solid", color: "#F9FAFB" }],
  border: { width: 1, color: "#D1D5DB", radius: 8 },
});
const image = (name, src) => ({
  type: "image", name, box: { width: "fill", height: 320 }, src, fit: "cover",
});

/** 노드가 정확히 `total`개인 페이지. 첫 text 노드 id는 `t0`(편집 측정 대상)다. */
export function buildPage(total, { imageSrc } = {}) {
  const nodes = {};
  const rootChildren = [];
  let left = total - 1; // root
  if (imageSrc !== undefined) {
    nodes.hero = image("Hero", imageSrc);
    rootChildren.push("hero");
    left -= 1;
  }
  let section = 0;
  let card = 0;
  while (left >= 5) {
    // 섹션 1 + 카드(frame 1 + 자식 3)를 최대 10개
    const sectionId = `s${section}`;
    left -= 1;
    const cards = [];
    while (left >= 4 && cards.length < 10) {
      const id = `c${card}`;
      nodes[`t${card}`] = text(`Title${card}`, `카드 ${card}`);
      nodes[`b${card}`] = button(`Action${card}`);
      nodes[`i${card}`] = input(`Field${card}`);
      nodes[id] = frame(`Card${card}`, "row", [`t${card}`, `b${card}`, `i${card}`]);
      cards.push(id);
      card += 1;
      left -= 4;
    }
    nodes[sectionId] = frame(`Section${section}`, "column", cards);
    rootChildren.push(sectionId);
    section += 1;
  }
  for (let index = 0; left > 0; index += 1, left -= 1) {
    nodes[`pad${index}`] = text(`Note${index}`, `메모 ${index}`);
    rootChildren.push(`pad${index}`);
  }
  nodes.root = {
    ...frame("Screen", "column", rootChildren),
    box: { width: "fill", height: "fill" },
    layout: { direction: "column", gap: 16, padding: { top: 24, right: 24, bottom: 24, left: 24 }, mainAxis: "start", crossAxis: "stretch" },
  };
  return { name: "Main", size: { width: 1440, height: 900 }, root: "root", nodes };
}

export function buildProject(name, nodeCount, options) {
  const spec = { version: "0.3", name, pages: { main: buildPage(nodeCount, options) }, pageOrder: ["main"] };
  const result = validateProjectSpec(spec);
  if (!result.valid) throw new Error(`픽스처가 스키마를 어깁니다: ${JSON.stringify(result.errors ?? result).slice(0, 500)}`);
  if (Object.keys(spec.pages.main.nodes).length !== nodeCount) throw new Error("노드 수가 맞지 않습니다");
  return spec;
}

/** 압축이 잘 안 되는(사진에 가까운) 잡음 PNG. 크기는 width×height×3 바이트 근처다. */
export function buildNoisePng(width, height, seed = 293) {
  let state = seed;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width * 3; x += 1) {
      state = (Math.imul(state, 1103515245) + 12345) >>> 0;
      raw[row + 1 + x] = state >>> 24;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2; // 8bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 1 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * `dir/.visual-spec`에 작업공간을 만든다. 돌려주는 값은 작업공간 경로와 측정 대상 프로젝트 이름.
 * 프로젝트 파일 이름은 p000.json…이고 이름은 "Perf 000"…이다.
 */
export function writeWorkspace(dir, { projects, nodes, image }) {
  const workspace = join(dir, ".visual-spec");
  for (const sub of ["specs", "generated", "assets", "runtime"]) mkdirSync(join(workspace, sub), { recursive: true });
  let imageBytes = 0;
  if (image !== undefined && !image.distinct) {
    const png = buildNoisePng(image.width, image.height);
    writeFileSync(join(workspace, "assets", "big.png"), png);
    imageBytes = png.length;
  }
  for (let index = 0; index < projects; index += 1) {
    const label = String(index).padStart(3, "0");
    // distinct면 프로젝트마다 다른 이미지(같은 크기, 다른 내용)를 둔다(#318).
    let imageSrc;
    if (image !== undefined) {
      imageSrc = image.distinct ? `assets/big-${label}.png` : "assets/big.png";
      if (image.distinct) {
        const png = buildNoisePng(image.width, image.height, 293 + index);
        writeFileSync(join(workspace, imageSrc), png);
        imageBytes += png.length;
      }
    }
    const spec = buildProject(`Perf ${label}`, nodes, imageSrc === undefined ? undefined : { imageSrc });
    writeFileSync(join(workspace, "specs", `p${label}.json`), JSON.stringify(spec));
  }
  return { workspace, target: "Perf 000", imageBytes };
}

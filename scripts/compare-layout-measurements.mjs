#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** 노드 bounds·셸 크기의 허용 오차(CSS px). docs/20-screen-layout-contract-qa.md 참고. */
export const TOLERANCE_CSS_PX = 1;
const PLACEHOLDER_KEYS = ["text", "color", "opacity", "fontFamily", "fontSize", "fontWeight"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/** 측정 JSON 하나의 모양을 확인한다. 잘못된 입력은 비교 실패(1)가 아니라 입력 오류(2)다. */
export function readMeasurement(value, label) {
  if (!isRecord(value) || typeof value.rootId !== "string" || value.rootId.length === 0 ||
      !isRecord(value.viewport) || !isRecord(value.nodes)) {
    throw new Error(`${label}: rootId, viewport, nodes 객체가 필요합니다.`);
  }

  const { viewport, nodes } = value;
  for (const key of ["width", "height", "devicePixelRatio", "visualViewportScale", "canvasZoomPercent"]) {
    if (!isFiniteNumber(viewport[key])) {
      throw new Error(`${label}: viewport.${key}는 유한한 숫자여야 합니다.`);
    }
  }
  if (viewport.width <= 0 || viewport.height <= 0 || viewport.devicePixelRatio <= 0 ||
      viewport.visualViewportScale <= 0 || viewport.canvasZoomPercent <= 0) {
    throw new Error(`${label}: viewport 크기와 배율은 0보다 커야 합니다.`);
  }
  if (typeof viewport.fontStatus !== "string" || !Array.isArray(viewport.fontFaces) ||
      !viewport.fontFaces.every((font) => typeof font === "string")) {
    throw new Error(`${label}: viewport.fontStatus와 문자열 배열 fontFaces가 필요합니다.`);
  }
  for (const [id, bounds] of Object.entries(nodes)) {
    if (!id || !isRecord(bounds)) throw new Error(`${label}: nodes.${id || "<empty>"} 측정값이 객체가 아닙니다.`);
    for (const key of ["x", "y", "width", "height"]) {
      if (!isFiniteNumber(bounds[key])) {
        throw new Error(`${label}: nodes.${id}.${key}는 유한한 숫자여야 합니다.`);
      }
    }
    if (bounds.width < 0 || bounds.height < 0) {
      throw new Error(`${label}: nodes.${id}의 width/height는 음수일 수 없습니다.`);
    }
    if (bounds.lines !== undefined && !(Number.isInteger(bounds.lines) && bounds.lines >= 0)) {
      throw new Error(`${label}: nodes.${id}.lines는 0 이상의 정수여야 합니다.`);
    }
  }
  if (!Object.hasOwn(nodes, value.rootId)) throw new Error(`${label}: root node missing: ${value.rootId}`);
  if (value.shell !== undefined) {
    if (!isRecord(value.shell) || !isFiniteNumber(value.shell.width) || !isFiniteNumber(value.shell.height)) {
      throw new Error(`${label}: shell.width/height는 유한한 숫자여야 합니다.`);
    }
  }
  for (const key of ["placeholders", "renderedFonts", "images"]) {
    if (value[key] !== undefined && !isRecord(value[key])) throw new Error(`${label}: ${key}는 객체여야 합니다.`);
  }
  return value;
}

/** `family/style/weight/status`에서 상태를 떼고 중복을 없앤다 — 탭마다 받은 subset 수가 다르다. */
function declaredFaces(fontFaces) {
  return [...new Set(fontFaces.map((font) => font.replace(/\/(loaded|unloaded|loading|error)$/, "")))].sort();
}

/**
 * GUI(reference)와 생성 앱(generated) 측정을 비교한다.
 * `loadErrors`는 폰트·이미지 로딩 실패라 레이아웃 판정과 따로 보고한다(측정 무효).
 */
export function compareMeasurements(reference, generated) {
  const errors = [];
  const loadErrors = [];
  if (reference.rootId !== generated.rootId) errors.push(`rootId: ${reference.rootId} != ${generated.rootId}`);
  for (const key of ["width", "height", "devicePixelRatio", "visualViewportScale", "canvasZoomPercent", "fontStatus"]) {
    if (JSON.stringify(reference.viewport[key]) !== JSON.stringify(generated.viewport[key])) {
      errors.push(`viewport.${key}: ${JSON.stringify(reference.viewport[key])} != ${JSON.stringify(generated.viewport[key])}`);
    }
  }
  const referenceFaces = declaredFaces(reference.viewport.fontFaces);
  const generatedFaces = declaredFaces(generated.viewport.fontFaces);
  if (JSON.stringify(referenceFaces) !== JSON.stringify(generatedFaces)) {
    errors.push(`viewport.fontFaces: ${JSON.stringify(referenceFaces)} != ${JSON.stringify(generatedFaces)}`);
  }
  for (const [label, measurement] of [["GUI", reference], ["generated", generated]]) {
    if (measurement.viewport.devicePixelRatio !== 1) errors.push(`${label} devicePixelRatio must be 1`);
    if (measurement.viewport.visualViewportScale !== 1) errors.push(`${label} visualViewportScale must be 1`);
    if (measurement.viewport.canvasZoomPercent !== 100) errors.push(`${label} canvasZoomPercent must be 100`);
    if (measurement.viewport.fontStatus !== "loaded") {
      loadErrors.push(`${label} fontStatus is ${measurement.viewport.fontStatus}, expected loaded`);
    }
    if (!measurement.viewport.fontFaces.some((font) => /^pretendard\/.*\/loaded$/i.test(font))) {
      loadErrors.push(`${label} Pretendard is not confirmed loaded`);
    }
    // 선언된 face가 loaded여도 노드가 다른 family 이름을 쓰면 폴백으로 그려진다. 실제 렌더 폰트로 확인한다.
    // 정적 폰트의 플랫폼 이름은 "Pretendard SemiBold"처럼 굵기가 붙는다.
    for (const [id, fonts] of Object.entries(measurement.renderedFonts ?? {})) {
      const fallback = fonts.filter((font) => !(font.isCustomFont && /^pretendard( |$)/i.test(font.familyName)));
      if (fonts.length === 0 || fallback.length > 0) {
        loadErrors.push(`${label} ${id} is not rendered with Pretendard web font (${JSON.stringify(fonts)})`);
      }
    }
    for (const [id, image] of Object.entries(measurement.images ?? {})) {
      if (image?.loaded !== true) loadErrors.push(`${label} image ${id} did not load`);
    }
  }

  const referenceIds = Object.keys(reference.nodes).sort();
  const generatedIds = Object.keys(generated.nodes).sort();
  for (const id of referenceIds) if (!Object.hasOwn(generated.nodes, id)) errors.push(`generated node missing: ${id}`);
  for (const id of generatedIds) if (!Object.hasOwn(reference.nodes, id)) errors.push(`unexpected generated node: ${id}`);

  const tolerance = TOLERANCE_CSS_PX;
  const rows = [];
  for (const id of referenceIds) {
    if (!Object.hasOwn(generated.nodes, id)) continue;
    const a = reference.nodes[id];
    const b = generated.nodes[id];
    const delta = Object.fromEntries(["x", "y", "width", "height"].map((key) => [key, Math.abs(a[key] - b[key])]));
    const passed = Object.values(delta).every((amount) => Number.isFinite(amount) && amount <= tolerance);
    rows.push({ id, passed, delta });
    if (!passed) errors.push(`${id}: bounds delta exceeds ${tolerance} CSS px (${JSON.stringify(delta)})`);
    if (a.lines !== undefined && b.lines !== undefined && a.lines !== b.lines) {
      errors.push(`${id}: line count ${a.lines} != ${b.lines}`);
    }
  }

  if (reference.shell && generated.shell) {
    for (const key of ["width", "height"]) {
      const amount = Math.abs(reference.shell[key] - generated.shell[key]);
      if (amount > tolerance) errors.push(`shell.${key}: ${reference.shell[key]} != ${generated.shell[key]}`);
    }
  }
  for (const [label, measurement] of [["GUI", reference], ["generated", generated]]) {
    const scrollHeight = measurement.shell?.documentScrollHeight;
    if (!isFiniteNumber(scrollHeight)) continue;
    // 문서는 viewport 또는 셸 중 큰 쪽만큼만 스크롤된다. 작으면 잘림, 크면 셸 밖 여분이다.
    const expected = Math.max(measurement.viewport.height, measurement.shell.height);
    if (Math.abs(scrollHeight - expected) > tolerance) {
      errors.push(`${label} document scrollHeight ${scrollHeight} != max(viewport, shell) ${expected}`);
    }
  }

  const referencePlaceholders = reference.placeholders ?? {};
  const generatedPlaceholders = generated.placeholders ?? {};
  for (const id of new Set([...Object.keys(referencePlaceholders), ...Object.keys(generatedPlaceholders)])) {
    const a = referencePlaceholders[id];
    const b = generatedPlaceholders[id];
    if (!a || !b) {
      errors.push(`placeholder ${id}: ${a ? "generated" : "GUI"} measurement missing`);
      continue;
    }
    for (const key of PLACEHOLDER_KEYS) {
      if (a[key] !== b[key]) errors.push(`placeholder ${id}.${key}: ${JSON.stringify(a[key])} != ${JSON.stringify(b[key])}`);
    }
    // 생성 <input>의 placeholder는 한 줄이다. GUI에서 줄바꿈되면 같은 모양을 낼 수 없다.
    for (const [label, entry] of [["GUI", a], ["generated", b]]) {
      if (entry.lines !== undefined && entry.lines > 1) errors.push(`placeholder ${id}: ${label} wraps to ${entry.lines} lines`);
    }
  }

  return { toleranceCssPx: tolerance, nodesCompared: rows.length, rows, loadErrors, errors };
}

/** 0 통과, 1 레이아웃·조건 불일치, 3 폰트·이미지 로딩 실패(측정 무효). 입력 오류는 2다. */
export function exitCodeFor(result) {
  if (result.loadErrors.length > 0) return 3;
  return result.errors.length > 0 ? 1 : 0;
}

function main() {
  const [referencePath, generatedPath] = process.argv.slice(2);
  if (!referencePath || !generatedPath) {
    console.error("사용법: node scripts/compare-layout-measurements.mjs <gui.json> <generated.json>");
    process.exit(2);
  }
  let reference;
  let generated;
  try {
    reference = readMeasurement(readJson(referencePath), referencePath);
    generated = readMeasurement(readJson(generatedPath), generatedPath);
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const result = compareMeasurements(reference, generated);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = exitCodeFor(result);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path}: JSON을 읽을 수 없습니다 (${error.message})`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

#!/usr/bin/env node

import { readFileSync } from "node:fs";

const [referencePath, generatedPath] = process.argv.slice(2);
if (!referencePath || !generatedPath) {
  console.error("사용법: node scripts/compare-layout-measurements.mjs <gui.json> <generated.json>");
  process.exit(2);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readMeasurement(path) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path}: JSON을 읽을 수 없습니다 (${error.message})`);
  }
  if (!isRecord(value) || typeof value.rootId !== "string" || value.rootId.length === 0 ||
      !isRecord(value.viewport) || !isRecord(value.nodes)) {
    throw new Error(`${path}: rootId, viewport, nodes 객체가 필요합니다.`);
  }

  const { viewport, nodes } = value;
  for (const key of ["width", "height", "devicePixelRatio", "visualViewportScale", "canvasZoomPercent"]) {
    if (typeof viewport[key] !== "number" || !Number.isFinite(viewport[key])) {
      throw new Error(`${path}: viewport.${key}는 유한한 숫자여야 합니다.`);
    }
  }
  if (viewport.width <= 0 || viewport.height <= 0 || viewport.devicePixelRatio <= 0 ||
      viewport.visualViewportScale <= 0 || viewport.canvasZoomPercent <= 0) {
    throw new Error(`${path}: viewport 크기와 배율은 0보다 커야 합니다.`);
  }
  if (typeof viewport.fontStatus !== "string" || !Array.isArray(viewport.fontFaces) ||
      !viewport.fontFaces.every((font) => typeof font === "string")) {
    throw new Error(`${path}: viewport.fontStatus와 문자열 배열 fontFaces가 필요합니다.`);
  }
  for (const [id, bounds] of Object.entries(nodes)) {
    if (!id || !isRecord(bounds)) throw new Error(`${path}: nodes.${id || "<empty>"} 측정값이 객체가 아닙니다.`);
    for (const key of ["x", "y", "width", "height"]) {
      if (typeof bounds[key] !== "number" || !Number.isFinite(bounds[key])) {
        throw new Error(`${path}: nodes.${id}.${key}는 유한한 숫자여야 합니다.`);
      }
    }
    if (bounds.width < 0 || bounds.height < 0) {
      throw new Error(`${path}: nodes.${id}의 width/height는 음수일 수 없습니다.`);
    }
  }
  if (!Object.hasOwn(nodes, value.rootId)) throw new Error(`${path}: root node missing: ${value.rootId}`);
  return value;
}

let reference;
let generated;
try {
  reference = readMeasurement(referencePath);
  generated = readMeasurement(generatedPath);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

const errors = [];
if (reference.rootId !== generated.rootId) errors.push(`rootId: ${reference.rootId} != ${generated.rootId}`);
for (const key of ["width", "height", "devicePixelRatio", "visualViewportScale", "canvasZoomPercent", "fontStatus", "fontFaces"]) {
  if (JSON.stringify(reference.viewport[key]) !== JSON.stringify(generated.viewport[key])) {
    errors.push(`viewport.${key}: ${JSON.stringify(reference.viewport[key])} != ${JSON.stringify(generated.viewport[key])}`);
  }
}
if (reference.viewport.fontStatus !== "loaded") errors.push(`GUI fontStatus is ${reference.viewport.fontStatus}, expected loaded`);
if (generated.viewport.fontStatus !== "loaded") errors.push(`generated fontStatus is ${generated.viewport.fontStatus}, expected loaded`);
for (const [label, measurement] of [["GUI", reference], ["generated", generated]]) {
  if (measurement.viewport.devicePixelRatio !== 1) errors.push(`${label} devicePixelRatio must be 1`);
  if (measurement.viewport.visualViewportScale !== 1) errors.push(`${label} visualViewportScale must be 1`);
  if (measurement.viewport.canvasZoomPercent !== 100) errors.push(`${label} canvasZoomPercent must be 100`);
  if (!measurement.viewport.fontFaces.some((font) => /pretendard.*\/loaded$/i.test(font))) {
    errors.push(`${label} Pretendard is not confirmed loaded`);
  }
}

const referenceIds = Object.keys(reference.nodes).sort();
const generatedIds = Object.keys(generated.nodes).sort();
for (const id of referenceIds) if (!Object.hasOwn(generated.nodes, id)) errors.push(`generated node missing: ${id}`);
for (const id of generatedIds) if (!Object.hasOwn(reference.nodes, id)) errors.push(`unexpected generated node: ${id}`);

const tolerance = 1;
const rows = [];
for (const id of referenceIds) {
  if (!Object.hasOwn(generated.nodes, id)) continue;
  const a = reference.nodes[id];
  const b = generated.nodes[id];
  const delta = Object.fromEntries(["x", "y", "width", "height"].map((key) => [key, Math.abs(a[key] - b[key])]));
  const passed = Object.values(delta).every((amount) => Number.isFinite(amount) && amount <= tolerance);
  rows.push({ id, passed, delta });
  if (!passed) errors.push(`${id}: bounds delta exceeds ${tolerance} CSS px (${JSON.stringify(delta)})`);
}

console.log(JSON.stringify({ toleranceCssPx: tolerance, nodesCompared: rows.length, rows, errors }, null, 2));
if (errors.length > 0) process.exitCode = 1;

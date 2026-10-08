#!/usr/bin/env node

import { readFileSync } from "node:fs";

const [referencePath, generatedPath] = process.argv.slice(2);
if (!referencePath || !generatedPath) {
  console.error("사용법: node scripts/compare-layout-measurements.mjs <gui.json> <generated.json>");
  process.exit(2);
}

function readMeasurement(path) {
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (typeof value.rootId !== "string" || !value.viewport || !value.nodes) {
    throw new Error(`${path}: rootId, viewport, nodes 필드가 필요합니다.`);
  }
  return value;
}

const reference = readMeasurement(referencePath);
const generated = readMeasurement(generatedPath);
const errors = [];

if (reference.rootId !== generated.rootId) errors.push(`rootId: ${reference.rootId} != ${generated.rootId}`);
for (const key of ["width", "height", "devicePixelRatio", "visualViewportScale", "fontStatus", "fontFaces"]) {
  if (JSON.stringify(reference.viewport[key]) !== JSON.stringify(generated.viewport[key])) {
    errors.push(`viewport.${key}: ${JSON.stringify(reference.viewport[key])} != ${JSON.stringify(generated.viewport[key])}`);
  }
}
if (reference.viewport.fontStatus !== "loaded") errors.push(`GUI fontStatus is ${reference.viewport.fontStatus}, expected loaded`);
if (generated.viewport.fontStatus !== "loaded") errors.push(`generated fontStatus is ${generated.viewport.fontStatus}, expected loaded`);
for (const [label, measurement] of [["GUI", reference], ["generated", generated]]) {
  if (measurement.viewport.devicePixelRatio !== 1) errors.push(`${label} devicePixelRatio must be 1`);
  if (measurement.viewport.visualViewportScale !== 1) errors.push(`${label} visualViewportScale must be 1`);
  if (!Array.isArray(measurement.viewport.fontFaces) ||
      !measurement.viewport.fontFaces.some((font) => /pretendard.*\/loaded$/i.test(font))) {
    errors.push(`${label} Pretendard is not confirmed loaded`);
  }
  if (!(measurement.rootId in measurement.nodes)) errors.push(`${label} root node missing: ${measurement.rootId}`);
}

const referenceIds = Object.keys(reference.nodes).sort();
const generatedIds = Object.keys(generated.nodes).sort();
for (const id of referenceIds) if (!(id in generated.nodes)) errors.push(`generated node missing: ${id}`);
for (const id of generatedIds) if (!(id in reference.nodes)) errors.push(`unexpected generated node: ${id}`);

const tolerance = 1;
const rows = [];
for (const id of referenceIds) {
  const a = reference.nodes[id];
  const b = generated.nodes[id];
  if (!b) continue;
  const delta = Object.fromEntries(["x", "y", "width", "height"].map((key) => [key, Math.abs(a[key] - b[key])]));
  const passed = Object.values(delta).every((value) => Number.isFinite(value) && value <= tolerance);
  rows.push({ id, passed, delta });
  if (!passed) errors.push(`${id}: bounds delta exceeds ${tolerance} CSS px (${JSON.stringify(delta)})`);
}

console.log(JSON.stringify({ toleranceCssPx: tolerance, nodesCompared: rows.length, rows, errors }, null, 2));
if (errors.length > 0) process.exitCode = 1;

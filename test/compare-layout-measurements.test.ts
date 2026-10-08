import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, expect, it } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SCRIPT = join(REPO_ROOT, "scripts", "compare-layout-measurements.mjs");
let scratch: string | undefined;

type Bounds = { x: number; y: number; width: number; height: number };
type Measurement = {
  rootId: string;
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
    visualViewportScale: number;
    fontStatus: string;
    fontFaces: string[];
  };
  nodes: Record<string, Bounds>;
};

function measurement(y = 0): Measurement {
  return {
    rootId: "root",
    viewport: {
      width: 390,
      height: 844,
      devicePixelRatio: 1,
      visualViewportScale: 1,
      canvasZoomPercent: 100,
      fontStatus: "loaded",
      fontFaces: ["Pretendard/normal/400/loaded"],
    },
    nodes: {
      root: { x: 0, y: 0, width: 390, height: 844 },
      title: { x: 20, y, width: 350, height: 32 },
    },
  };
}

function compare(gui: unknown, generated: unknown) {
  scratch = mkdtempSync(join(tmpdir(), "vsb-layout-compare-"));
  const guiPath = join(scratch, "gui.json");
  const generatedPath = join(scratch, "generated.json");
  writeFileSync(guiPath, JSON.stringify(gui));
  writeFileSync(generatedPath, JSON.stringify(generated));
  return spawnSync(process.execPath, [SCRIPT, guiPath, generatedPath], { encoding: "utf8" });
}

function mutableJson(measurementValue: Measurement) {
  return JSON.parse(JSON.stringify(measurementValue)) as {
    viewport: Record<string, unknown>;
    nodes: Record<string, unknown>;
  };
}

afterEach(() => {
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true });
  scratch = undefined;
});

it("모든 노드 bounds 차이가 1 CSS px 이하면 통과한다", () => {
  const result = compare(measurement(), measurement(1));

  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout).nodesCompared).toBe(2);
});

it("노드 bounds 차이가 1 CSS px를 넘으면 실패한다", () => {
  const result = compare(measurement(), measurement(1.01));

  expect(result.status).toBe(1);
  expect(result.stdout).toContain("bounds delta exceeds 1 CSS px");
});

it("viewport/font 조건과 노드 ID가 다르면 실패한다", () => {
  const generated = measurement();
  generated.viewport.width = 412;
  generated.viewport.fontFaces = ["Arial/normal/400/loaded"];
  generated.nodes.subtitle = { x: 20, y: 40, width: 350, height: 20 };

  const result = compare(measurement(), generated);
  const report = JSON.parse(result.stdout) as { errors: string[] };

  expect(result.status).toBe(1);
  expect(report.errors).toEqual(expect.arrayContaining([
    expect.stringContaining("viewport.width"),
    expect.stringContaining("viewport.fontFaces"),
    expect.stringContaining("unexpected generated node: subtitle"),
  ]));
});

it("필수 노드 측정이 null이거나 필수 viewport 치수가 없으면 실패한다", () => {
  const generated = mutableJson(measurement());
  generated.nodes.title = null;

  const missingNode = compare(measurement(), generated);
  expect(missingNode.status).toBe(2);
  expect(missingNode.stderr).toContain("nodes.title 측정값이 객체가 아닙니다");

  const missingViewport = mutableJson(measurement());
  delete missingViewport.viewport.height;
  const invalidViewport = compare(measurement(), missingViewport);
  expect(invalidViewport.status).toBe(2);
  expect(invalidViewport.stderr).toContain("viewport.height는 유한한 숫자여야 합니다");
});

it("문자열 좌표와 음수 치수는 측정값으로 허용하지 않는다", () => {
  const stringCoordinate = mutableJson(measurement());
  stringCoordinate.nodes.title = { ...(stringCoordinate.nodes.title as Bounds), x: "20" };
  const invalidCoordinate = compare(measurement(), stringCoordinate);
  expect(invalidCoordinate.status).toBe(2);
  expect(invalidCoordinate.stderr).toContain("nodes.title.x는 유한한 숫자여야 합니다");

  const negativeSize = mutableJson(measurement());
  negativeSize.nodes.title = { ...(negativeSize.nodes.title as Bounds), width: -1 };
  const invalidSize = compare(measurement(), negativeSize);
  expect(invalidSize.status).toBe(2);
  expect(invalidSize.stderr).toContain("width/height는 음수일 수 없습니다");
});

it("Canvas 확대율이 100%가 아니면 좌표 비교를 통과시키지 않는다", () => {
  const generated = measurement();
  generated.viewport.canvasZoomPercent = 50;
  const result = compare(measurement(), generated);
  const report = JSON.parse(result.stdout) as { errors: string[] };

  expect(result.status).toBe(1);
  expect(report.errors).toContain("generated canvasZoomPercent must be 100");
});

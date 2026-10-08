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
      fontStatus: "loaded",
      fontFaces: ["Pretendard/normal/400/loaded"],
    },
    nodes: {
      root: { x: 0, y: 0, width: 390, height: 844 },
      title: { x: 20, y, width: 350, height: 32 },
    },
  };
}

function compare(gui: Measurement, generated: Measurement) {
  scratch = mkdtempSync(join(tmpdir(), "vsb-layout-compare-"));
  const guiPath = join(scratch, "gui.json");
  const generatedPath = join(scratch, "generated.json");
  writeFileSync(guiPath, JSON.stringify(gui));
  writeFileSync(generatedPath, JSON.stringify(generated));
  return spawnSync(process.execPath, [SCRIPT, guiPath, generatedPath], { encoding: "utf8" });
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

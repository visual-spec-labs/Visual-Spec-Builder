import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { CSSProperties } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import { expect, it } from "vitest";

import type { FrameNode } from "@/features/editor/schema";
import { boxStyle } from "../src/features/editor/ui/canvasLayout";
import { frameStyle } from "../src/features/editor/ui/nodeStyles";

const AXES = ["start", "center", "end", "stretch"] as const;
type Axis = (typeof AXES)[number];

const browserCandidates = [
  process.env.CHROME_BIN,
  process.env.VSB_GRID_CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter((candidate): candidate is string => candidate !== undefined);
const browser = browserCandidates.find(existsSync);

// Opt-in actual browser QA: VSB_GRID_BROWSER=1 CHROME_BIN=<Chromium executable>.

function gridNode(columns: number, crossAxis: Axis): FrameNode {
  return {
    type: "frame",
    name: "Grid",
    box: { width: "fill", height: "fill" },
    layout: {
      direction: "grid",
      columns,
      gap: 12,
      padding: { top: 12, right: 12, bottom: 12, left: 12 },
      mainAxis: "start",
      crossAxis,
    },
    children: [],
  };
}

function cards(id: string, className: string, style?: CSSProperties, canvas = false) {
  const children = ["one line", "two lines\nsecond", "fill", "last"];
  return createElement("div", { id, className, style }, children.map((text, index) => {
    const size = { width: "fill", height: index === 2 ? "fill" : "auto" } as const;
    const childStyle = { ...boxStyle(size, "grid"), padding: 4 };
    return createElement("div", {
      key: index,
      className: index === 2 ? "w-full h-full p-[4px]" : "w-full h-auto p-[4px]",
      style: canvas ? childStyle : undefined,
    }, createElement("span", { style: { whiteSpace: "pre-line", lineHeight: "24px" } }, text));
  }));
}

function rootStyle(columns: number, axis: Axis): CSSProperties {
  return {
    ...frameStyle(gridNode(columns, axis), undefined),
    width: 620,
    height: 220,
    boxSizing: "border-box",
  };
}

function classFor(columns: number, axis: Axis): string {
  return `grid grid-cols-[repeat(${columns},1fr)] items-${axis} gap-[12px] p-[12px]`;
}

const harnessStyle: CSSProperties = {
  width: 620,
  height: 220,
  gap: 12,
  padding: 12,
  boxSizing: "border-box",
};

it.runIf(process.env.VSB_GRID_BROWSER === "1")(
  "Grid Tailwind output matches canvas layout for columns, auto/fill, crossAxis, and breakpoints",
  async () => {
    if (browser === undefined) throw new Error("Set CHROME_BIN or VSB_GRID_CHROME to a Chromium executable.");
    const directory = mkdtempSync(join(tmpdir(), "vsb-grid-codegen-"));
    try {
      const breakpointClasses = [
        "grid-cols-[repeat(1,1fr)]", "items-start",
        "min-[700px]:grid-cols-[repeat(2,1fr)]", "min-[700px]:items-center",
        "min-[900px]:grid-cols-[repeat(3,1fr)]", "min-[900px]:items-stretch",
        "grid", "gap-[12px]", "p-[12px]",
        "w-full", "h-full", "h-auto", "p-[4px]",
      ];
      const classes = [
        ...[1, 2, 3].flatMap((columns) => AXES.map((axis) => classFor(columns, axis))),
        breakpointClasses.join(" "),
      ].flatMap((value) => value.split(" "));
      const compiler = await compile("@tailwind utilities;");
      const css = compiler.build(classes);
      const examples = [
        ...[1, 2, 3].flatMap((columns) => AXES.map((axis) =>
          cards(`compiled-${columns}-${axis}`, classFor(columns, axis), harnessStyle))),
        ...[1, 2, 3].flatMap((columns) => AXES.map((axis) =>
          cards(`canvas-${columns}-${axis}`, "", rootStyle(columns, axis), true))),
        cards("responsive", breakpointClasses.join(" "), harnessStyle),
        cards("responsive-base", "", rootStyle(1, "start"), true),
        cards("responsive-tablet", "", rootStyle(2, "center"), true),
        cards("responsive-desktop", "", rootStyle(3, "stretch"), true),
      ];
      const html = `<!doctype html><meta charset="utf-8"><style>
        *{box-sizing:border-box} body{margin:0;overflow:hidden} ${css}
        .canvas-grid{display:grid}
      </style>${examples.map((example) => renderToStaticMarkup(example)).join("")}
      <pre id="results"></pre><script>
        const rect = (element) => {
          const {x,y,width,height}=element.getBoundingClientRect();
          return [x,y,width,height].map(value=>Math.round(value*100)/100);
        };
        const measure = (id) => {
          const root=document.getElementById(id), style=getComputedStyle(root);
          const origin=root.getBoundingClientRect();
          return {tracks:style.gridTemplateColumns,axis:style.alignItems,
            children:[...root.children].map(child=>{
              const [x,y,width,height]=rect(child);
              return [x-origin.x,y-origin.y,width,height];
            })};
        };
        const results=[];
        const width=innerWidth;
        if(width===699 && location.search!=='?repeat=1'){
          for(const [columns,axis] of [[1,'start'],[1,'center'],[1,'end'],[1,'stretch'],
            [2,'start'],[2,'center'],[2,'end'],[2,'stretch'],
            [3,'start'],[3,'center'],[3,'end'],[3,'stretch']]){
            results.push({id:columns+'-'+axis,generated:measure('compiled-'+columns+'-'+axis),
              canvas:measure('canvas-'+columns+'-'+axis)});
          }
        }
        const reference=width>=900?'responsive-desktop':width>=700?'responsive-tablet':'responsive-base';
        results.push({id:'responsive-'+width,generated:measure('responsive'),canvas:measure(reference)});
        document.getElementById('results').textContent=JSON.stringify(results);
      </script>`;
      const fixture = join(directory, "grid.html");
      writeFileSync(fixture, html);
      const results: { id: string; generated: unknown; canvas: unknown }[] = [];
      for (const [index, width] of [699, 700, 899, 900, 901, 699].entries()) {
        const args = [
          "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-extensions",
          `--window-size=${width + 16},800`, `--user-data-dir=${join(directory, `profile-${width}-${results.length}`)}`,
          "--dump-dom", `${pathToFileURL(fixture).href}${index === 5 ? "?repeat=1" : ""}`,
        ];
        const output = execFileSync(browser, args, { encoding: "utf8", timeout: 30000 });
        const serialized = /<pre id="results">([\s\S]*?)<\/pre>/.exec(output)?.[1];
        if (serialized === undefined) throw new Error(`Chromium did not return layout results:\n${output}`);
        results.push(...JSON.parse(serialized) as typeof results);
      }
      for (const result of results) expect(result.generated, result.id).toEqual(result.canvas);
      expect(results).toHaveLength(18);
      console.info(`Grid Chromium QA: ${JSON.stringify(results)}`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
  40000,
);

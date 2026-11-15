import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import type { FrameNode } from "@/features/editor/schema";
import { frameStyle } from "../src/features/editor/ui/nodeStyles";

// Synthetic shell versus Canvas styles, not AI output. Same opt-in dependencies
// as responsive-codegen-browser.test.ts: Python Playwright and Chromium.
it.runIf(process.env.VSB_PAGE_SHELL_BROWSER === "1")("문서 셸은 고정/반응형 폭과 짧고 긴 root의 Canvas 크기를 보존한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "vsb-page-shell-"));
  try {
    const skill = readFileSync(new URL("../skills/visual-spec-to-react/SKILL.md", import.meta.url), "utf8");
    const section = skill.split("### 페이지 viewport와 브라우저 기본 스타일")[1];
    const css = section.split("<style>{`")[1].split("`}</style>")[0]
      .replace(/@import[^;]*;/g, ""); // Offline geometry test; no font parity claim.
    const root: FrameNode = {
      type: "frame", name: "Root", box: { width: "fill", height: "fill" },
      layout: { direction: "column", gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 },
        mainAxis: "start", crossAxis: "stretch" },
      children: [],
    };
    const node = (id: string) => renderToStaticMarkup(createElement("div", {
      id, style: frameStyle(root, undefined),
    }, createElement("div", { className: "content", style: { height: 32, flexShrink: 0 } })));
    writeFileSync(join(directory, "index.html"), `<!doctype html><style>${css}</style>
      <div id="canvas" style="display:flex;flex-direction:column">${node("reference")}</div>
      <main class="vsb-page">${node("generated")}</main>`);
    const output = execFileSync("python", ["-c", `
import json, sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page()
    page.set_content(open(sys.argv[1]).read())
    results = []
    for responsive, width, height, content in [
        (False,390,844,32), (False,390,1000,32), (False,320,1000,32),
        (False,390,844,1200), (True,767,1000,32), (True,768,1000,32),
        (True,1024,1000,32), (True,1600,1000,32), (True,1600,1000,1200)]:
        page.set_viewport_size({'width':width,'height':height})
        screen_height = 900 if responsive else 844
        expected_width = width if responsive else 390
        actual = page.evaluate('''({responsive,width,screenHeight,content}) => {
          const canvas = document.getElementById('canvas');
          canvas.style.width = width + 'px'; canvas.style.minHeight = screenHeight + 'px';
          const shell = document.querySelector('.vsb-page');
          shell.style.setProperty('--vsb-page-width', responsive ? '100%' : '390px');
          shell.style.setProperty('--vsb-page-height', screenHeight + 'px');
          document.querySelectorAll('.content').forEach(el => el.style.height = content + 'px');
          const rect = id => { const r = document.getElementById(id).getBoundingClientRect();
            return {width:r.width,height:r.height}; };
          return {reference:rect('reference'),generated:rect('generated'),shellScroll:shell.scrollHeight};
        }''', {'responsive':responsive,'width':expected_width,'screenHeight':screen_height,'content':content})
        expected = {'width':expected_width,'height':max(screen_height,content)}
        assert actual['reference'] == expected, (expected,actual)
        assert actual['generated'] == expected, (expected,actual)
        assert actual['shellScroll'] >= content, actual
        results.append({'responsive':responsive,'viewport':[width,height],'content':content,**actual})
    browser.close()
    print(json.dumps(results))
`, join(directory, "index.html")], { encoding: "utf8", timeout: 30000 });
    expect(JSON.parse(output)).toHaveLength(9);
    console.info(`Page shell Chromium QA: ${output.trim()}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 40000);

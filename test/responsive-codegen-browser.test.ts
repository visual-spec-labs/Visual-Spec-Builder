import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import { expect, it } from "vitest";

import { frameStyle } from "../src/features/editor/ui/nodeStyles";
import { autoSizedCardsSpec, responsiveCardsClasses, responsiveCardsCss } from "./fixtures/responsive-codegen";

// Opt-in actual browser QA: requires Python Playwright and /usr/bin/chromium.
// VSB_RESPONSIVE_BROWSER=1 pnpm exec vitest run test/responsive-codegen-browser.test.ts
it.runIf(process.env.VSB_RESPONSIVE_BROWSER === "1")("auto 카드: 수정 전 stretch 재현, Tailwind/CSS/캔버스 style 경계값 정합성", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vsb-responsive-browser-"));
  try {
    const spec = autoSizedCardsSpec();
    const root = spec.screen.nodes.root;
    if (root.type !== "frame") throw new Error("fixture root must be a frame");
    const compiler = await compile("@theme { --color-transparent: transparent; } @tailwind utilities;");
    const css = compiler.build(responsiveCardsClasses.split(" "));
    const children = root.children.map(({ node }, index) => {
      const card = spec.screen.nodes[node];
      if (card.type !== "frame") throw new Error("fixture child must be a frame");
      return createElement("div", { key: node, style: frameStyle(card, "row") },
        createElement("span", { style: { lineHeight: "26px" } }, "card"),
        index === 1 ? createElement("span", { style: { lineHeight: "26px" } }, "second line") : null);
    });
    const roots = [
      createElement("div", { id: "fixed", className: responsiveCardsClasses }, children),
      createElement("div", { id: "broken", className: responsiveCardsClasses.replace(" items-start", "") }, children),
      createElement("div", { id: "fallback", className: "vsb-card-effects-root" }, children),
      ...[767, 768, 1024].map((width) => {
        const node = structuredClone(root);
        if (width >= 768) node.layout.padding.left = 32;
        if (width >= 1024) { node.layout.gap = 32; node.background = []; }
        return createElement("div", { id: `reference-${width}`, key: width, style: frameStyle(node, undefined) }, children);
      }),
    ];
    writeFileSync(join(directory, "index.html"), `<!doctype html><style>*{box-sizing:border-box}body{margin:0}body>div{height:300px!important}${css}${responsiveCardsCss}</style>${roots.map((element) => renderToStaticMarkup(element)).join("")}`);
    const result = execFileSync("python", ["-c", `
import json, sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(open(sys.argv[1]).read())
    results = []
    for width in [767,768,769,1023,1024,1025,767]:
        page.set_viewport_size({'width':width,'height':1000})
        values = page.evaluate('''() => {
          const read = (id) => {
            const el = document.getElementById(id), s = getComputedStyle(el);
            return {align:s.alignItems, direction:s.flexDirection, gap:s.gap, left:s.paddingLeft,
              top:s.paddingTop, color:s.backgroundColor, image:s.backgroundImage,
              heights:[...el.children].map(x=>x.getBoundingClientRect().height)};
          };
          const width=innerWidth;
          return {fixed:read('fixed'), fallback:read('fallback'), broken:read('broken'),
            reference:read('reference-'+(width>=1024?1024:width>=768?768:767))};
        }''')
        assert values['fixed'] == values['reference'], (width, values)
        assert values['fallback'] == values['reference'], (width, values)
        assert values['broken']['heights'][0] > values['fixed']['heights'][0], (width, values)
        assert values['fixed']['heights'][0] < values['fixed']['heights'][1], (width, values)
        results.append({'width':width, **values})
    assert not errors, errors
    browser.close()
    print(json.dumps(results))
`, join(directory, "index.html")], { encoding: "utf8", timeout: 30000 });
    expect(JSON.parse(result)).toHaveLength(7);
    console.info(`Chromium responsive QA: ${result.trim()}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 40000);

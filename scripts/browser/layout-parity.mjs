// 선택적 실측(#280): 실제 GUI 아트보드 DOM과 생성 앱 DOM의 모든 노드 bounds를 같은 조건에서 비교한다.
// 생성 쪽 기본값은 test/fixtures/layout-parity의 수동 매핑 fixture이며 실제 AI 출력이 아니다.
// 실제 생성 결과는 둘 중 하나로 잰다. {page}에는 스펙의 page.name(예: Login)이 들어간다.
//   --generated-dir <Export 결과 폴더>  pages/<page>.tsx를 layout-parity-app 틀(Vite + Tailwind v4)로 띄운다.
//   --generated-url "http://127.0.0.1:5173/?page={page}"  이미 실행 중인 대상 앱을 그대로 잰다.
// 에이전트·모델 프로세스는 실행하지 않는다. 외부 요청은 고정한 Pretendard CDN 경로만 허용한다.
import { createHash, randomUUID } from "node:crypto";
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { compareMeasurements, readMeasurement, TOLERANCE_CSS_PX } from "../compare-layout-measurements.mjs";
import { startBrowserWorkspace } from "./harness.mjs";

const PRETENDARD = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/";
const FIXTURE_PATH = "/test/fixtures/layout-parity/index.html?page={page}";
const EDITOR_VIEWPORT = { width: 1920, height: 1080 };

const { values: args } = parseArgs({ options: {
  "generated-url": { type: "string" },
  "generated-dir": { type: "string" },
  case: { type: "string", multiple: true },
  out: { type: "string" },
} });

const readExample = async (name) => JSON.parse(await readFile(new URL(`../../examples/${name}`, import.meta.url), "utf8"));
const project = (name, pages) => ({ version: "0.3", name, pageOrder: Object.keys(pages), pages });
const login = (await readExample("login-screen.json")).screen;
const imageHero = (await readExample("image-hero.json")).screen;
const responsiveCards = (await readExample("responsive-cards.json")).screen;
const twoPage = await readExample("two-page-project.json");

// 긴 페이지: 로그인 아래에 약관 텍스트(줄바꿈)와 520px 배너를 더해 844px를 넘긴다.
const longLogin = structuredClone(login);
longLogin.name = "LongLogin";
longLogin.nodes.terms = {
  type: "text", name: "Terms", box: { width: "fill", height: "auto" },
  content: "이용약관에 동의하면 계정을 만들 수 있습니다. 개인정보는 서비스 제공과 보안 확인에만 사용하며, 동의 없이 제3자에게 제공하지 않습니다. 자세한 내용은 고객센터에서 언제든지 확인할 수 있습니다.",
  color: "#4B5563",
  typography: { fontFamily: "Pretendard", fontSize: 14, fontWeight: 400, lineHeight: 22, letterSpacing: 0, textAlign: "left" },
};
longLogin.nodes.banner = {
  type: "frame", name: "Banner", box: { width: "fill", height: 520 },
  layout: { direction: "column", gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, mainAxis: "start", crossAxis: "stretch" },
  background: [{ type: "solid", color: "#E0E7FF" }], children: [],
};
// 모든 폭에서 숨긴 노드는 GUI가 그리지 않고 생성 코드도 내지 않는다(비교 대상 ID에서 빠진다).
longLogin.nodes.promo = {
  type: "text", name: "Promo", visible: false, box: { width: "fill", height: "auto" },
  content: "숨긴 안내 문구", color: "#111111",
  typography: { fontFamily: "Pretendard", fontSize: 14, fontWeight: 400, lineHeight: 20, letterSpacing: 0, textAlign: "left" },
};
longLogin.nodes.root.children.push({ node: "terms" }, { node: "promo" }, { node: "banner" });

const fixed = (width, height) => ({ width, height });
const TARGETS = [
  { file: "parity-login.json", spec: project("ParityLogin", { login }), page: "login", checks: [
    { generated: "login-screen", viewports: [fixed(390, 844), fixed(390, 1000), fixed(320, 844)] },
    // 과거 h-full 실패 형태의 재구성. 비교기가 root 높이 차이를 잡아야 정상이다.
    { generated: "login-legacy", viewports: [fixed(390, 844)], expectFailure: "root" },
  ] },
  { file: "parity-long.json", spec: project("ParityLong", { long: longLogin }), page: "long", checks: [
    { generated: "long-login", viewports: [fixed(390, 844)] },
  ] },
  { file: "parity-image.json", spec: project("ParityImage", { hero: imageHero }), page: "hero", checks: [
    { generated: "image-hero", viewports: [fixed(390, 844)] },
  ] },
  { file: "parity-responsive.json", spec: project("ParityResponsive", { cards: responsiveCards }), page: "cards", checks: [
    { generated: "responsive-cards", viewports: [767, 768, 769, 1023, 1024, 1025, 1440, 1600].map((width) => fixed(width, 1000)) },
  ] },
  { file: "parity-two-page.json", spec: twoPage, page: "login", checks: [
    { generated: "two-page-login", viewports: [fixed(390, 844)] },
  ] },
  { file: "parity-two-page.json", spec: twoPage, page: "dashboard", checks: [
    { generated: "two-page-dashboard", viewports: [fixed(1440, 900)] },
  ] },
];
if (args["generated-url"] && args["generated-dir"]) throw new Error("--generated-url과 --generated-dir 중 하나만 지정합니다.");
// 실제 생성 결과에는 fixture 전용 대조군(과거 h-full 재구성)이 없다.
const external = Boolean(args["generated-url"] || args["generated-dir"]);
const selected = TARGETS.map((target) => ({ ...target, checks: target.checks.filter((check) =>
  (!args.case || args.case.includes(check.generated)) && !(external && check.expectFailure)) }))
  .filter((target) => target.checks.length > 0);
if (selected.length === 0) throw new Error(`선택한 사례가 없습니다: ${args.case}`);

/** 스펙에서 보여야 하는 노드 ID(visible:false와 그 자손 제외). */
function visibleSpecIds(screen) {
  const ids = [];
  const walk = (id) => {
    const node = screen.nodes[id];
    if (!node || node.visible === false) return;
    ids.push(id);
    for (const child of node.children ?? []) walk(child.node);
  };
  walk(screen.root);
  return ids.sort();
}

// 브라우저 안에서 실행한다. GUI와 생성 앱 모두 같은 함수로 잰다.
async function captureInPage({ scopeSelector, shellSelector, rootId, inputIds, viewport, documentScroll }) {
  const scope = scopeSelector ? document.querySelector(scopeSelector) : document;
  if (!scope) throw new Error(`측정 범위가 없습니다: ${scopeSelector}`);
  const all = [...scope.querySelectorAll("[data-node-id]")];
  const ids = all.map((element) => element.dataset.nodeId);
  const duplicateIds = [...new Set(ids.filter((id, index) => id && ids.indexOf(id) !== index))];
  const emptyIds = ids.filter((id) => !id).length;
  const isVisible = (element) => {
    for (let current = element; current instanceof Element; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
    }
    return element.getClientRects().length > 0;
  };
  const visible = all.filter(isVisible);
  const hiddenNodeIds = all.filter((element) => !isVisible(element)).map((element) => element.dataset.nodeId);
  const placeholderElement = (element) => element instanceof HTMLInputElement ? null : element.querySelector(":scope > span");

  // unicode-range subset까지 받도록 실제 글자로 폰트를 요청한 뒤 전체 준비를 기다린다.
  await Promise.all(visible.flatMap((element) => {
    const style = getComputedStyle(element);
    const texts = [element.textContent, element.getAttribute("placeholder")].filter((text) => text?.trim());
    return texts.map((text) => document.fonts.load(`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, text));
  }));
  await document.fonts.ready;

  const images = {};
  for (const element of visible) {
    const id = element.dataset.nodeId;
    if (element instanceof HTMLImageElement) {
      try { await element.decode(); } catch { /* 아래 loaded=false로 보고한다 */ }
      images[id] = { loaded: element.complete && element.naturalWidth > 0, naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight };
      continue;
    }
    const match = /url\("(.+?)"\)/.exec(getComputedStyle(element).backgroundImage);
    if (!match) continue;
    const image = new Image();
    image.src = match[1];
    let loaded = true;
    try { await image.decode(); } catch { loaded = false; }
    images[id] = { loaded: loaded && image.naturalWidth > 0, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const lineCount = (element) => {
    const texts = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (texts.length === 0) return undefined;
    const range = document.createRange();
    const tops = new Set();
    for (const text of texts) {
      range.selectNodeContents(text);
      for (const rect of range.getClientRects()) if (rect.width > 0) tops.add(Math.round(rect.top));
    }
    return tops.size;
  };
  const root = visible.find((element) => element.dataset.nodeId === rootId);
  if (!root) throw new Error("표시 중인 root가 없습니다.");
  // GUI 아트보드의 transform: scale을 되돌린다. 좌표는 root 바깥 모서리 기준이라 pan과 무관하다.
  const shellElement = shellSelector ? document.querySelector(shellSelector) : null;
  const scale = scopeSelector && shellElement ? shellElement.getBoundingClientRect().width / shellElement.offsetWidth : 1;
  const rootRect = root.getBoundingClientRect();
  const nodes = {};
  for (const element of visible) {
    const rect = element.getBoundingClientRect();
    const lines = lineCount(element);
    nodes[element.dataset.nodeId] = {
      x: (rect.left - rootRect.left) / scale, y: (rect.top - rootRect.top) / scale,
      width: rect.width / scale, height: rect.height / scale, ...(lines === undefined ? {} : { lines }),
    };
  }
  const placeholders = {};
  for (const id of inputIds) {
    const element = visible.find((candidate) => candidate.dataset.nodeId === id);
    if (!element) continue;
    const span = placeholderElement(element);
    const style = span ? getComputedStyle(span) : getComputedStyle(element, "::placeholder");
    placeholders[id] = {
      text: span ? span.textContent : element.placeholder, color: style.color, opacity: style.opacity,
      fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
      ...(span ? { lines: lineCount(span) } : {}),
    };
  }
  const shellRect = shellElement?.getBoundingClientRect();
  return {
    rootId,
    viewport: {
      width: viewport.width, height: viewport.height, devicePixelRatio,
      visualViewportScale: visualViewport?.scale ?? 1,
      canvasZoomPercent: Math.round(scale * 10000) / 100,
      fontStatus: document.fonts.status,
      fontFaces: [...new Set([...document.fonts].map((font) => `${font.family}/${font.style}/${font.weight}/${font.status}`))].sort(),
      window: { width: innerWidth, height: innerHeight },
    },
    nodes,
    placeholders,
    images,
    ...(shellRect ? { shell: {
      width: shellRect.width / scale, height: shellRect.height / scale, scrollHeight: shellElement.scrollHeight,
      ...(documentScroll ? { documentScrollHeight: document.scrollingElement.scrollHeight } : {}),
    } } : {}),
    ...(documentScroll ? { documentScrollHeight: document.scrollingElement.scrollHeight } : {}),
    duplicateIds, emptyIds, hiddenNodeIds,
  };
}

/** CDP로 각 텍스트를 실제로 그린 플랫폼 폰트를 읽는다. 선언된 FontFace만으로는 폴백 여부를 알 수 없다. */
async function readRenderedFonts(page, capture, inputIds) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
    const byId = new Map();
    const attribute = (node, name) => {
      const attributes = node.attributes ?? [];
      for (let index = 0; index < attributes.length; index += 2) if (attributes[index] === name) return attributes[index + 1];
      return undefined;
    };
    const walk = (node) => {
      const id = attribute(node, "data-node-id");
      if (id !== undefined && !byId.has(id)) byId.set(id, node);
      for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? []), ...(node.contentDocument ? [node.contentDocument] : [])]) walk(child);
    };
    walk(root);
    const fontsOf = async (nodeId) => (await cdp.send("CSS.getPlatformFontsForNode", { nodeId })).fonts
      .map(({ familyName, isCustomFont }) => ({ familyName, isCustomFont }));
    const findPlaceholder = (node) => {
      if (attribute(node, "id") === "placeholder" || attribute(node, "pseudo") === "-webkit-input-placeholder") return node;
      for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? [])]) {
        const found = findPlaceholder(child);
        if (found) return found;
      }
      return undefined;
    };
    const renderedFonts = {};
    const unavailable = [];
    for (const [id, bounds] of Object.entries(capture.nodes)) {
      const node = byId.get(id);
      if (bounds.lines !== undefined && node) renderedFonts[id] = await fontsOf(node.nodeId);
    }
    for (const id of inputIds) {
      const node = byId.get(id);
      if (!node || !capture.nodes[id]) continue;
      const target = node.nodeName === "INPUT" ? findPlaceholder(node) : node.children?.find((child) => child.nodeName === "SPAN");
      if (target) renderedFonts[`${id}::placeholder`] = await fontsOf(target.nodeId);
      else unavailable.push(`${id}::placeholder`);
    }
    return { renderedFonts, unavailable };
  } finally {
    await cdp.detach();
  }
}

async function capture(page, options, inputIds) {
  const result = await page.evaluate(captureInPage, { ...options, inputIds });
  const { renderedFonts, unavailable } = await readRenderedFonts(page, result, inputIds);
  return { ...result, renderedFonts, renderedFontsUnavailable: unavailable };
}

const workspace = await mkdtemp(join(tmpdir(), "vs-layout-parity-"));
// Vite가 서빙할 수 있게 저장소 안의 gitignore된 node_modules 아래에 틀과 Export 결과를 복사하고, 끝나면 지운다.
const generatedRun = args["generated-dir"]
  ? join(fileURLToPath(new URL("../../node_modules/.vsb-layout-parity/", import.meta.url)), randomUUID()) : null;
const fontCache = new Map();
const fontLog = { requests: 0, failures: [] };
let runner;
let exitCode = 0;
try {
  for (const dir of ["specs", "assets"]) await mkdir(join(workspace, dir), { recursive: true });
  for (const target of TARGETS) await writeFile(join(workspace, "specs", target.file), JSON.stringify(target.spec));
  // GUI와 생성 앱이 같은 이미지 바이트를 읽는다.
  await copyFile(new URL("../../test/fixtures/layout-parity/assets/hero.png", import.meta.url), join(workspace, "assets/hero.png"));

  if (generatedRun) {
    await cp(fileURLToPath(new URL("./layout-parity-app/", import.meta.url)), generatedRun, { recursive: true });
    await cp(resolve(args["generated-dir"]), join(generatedRun, "app"), { recursive: true });
  }
  runner = await startBrowserWorkspace(workspace);
  const base = runner.url.replace(/\/$/, "");
  const generatedTemplate = args["generated-url"] ?? (generatedRun
    ? `${base}/node_modules/.vsb-layout-parity/${basename(generatedRun)}/index.html?page={page}`
    : `${base}${FIXTURE_PATH}`);
  const generatedOrigin = new URL(generatedTemplate.replace("{page}", "x")).origin;
  // harness의 같은-origin 제한 뒤에 등록해 먼저 적용된다. 두 탭이 같은 폰트 바이트를 받도록 캐시한다.
  const allowExtra = async (context) => {
    await context.route(`${PRETENDARD}**`, async (route) => {
      const url = route.request().url();
      try {
        let entry = fontCache.get(url);
        if (!entry) {
          const response = await route.fetch();
          if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
          entry = { status: response.status(), headers: response.headers(), body: await response.body() };
          fontCache.set(url, entry);
        }
        fontLog.requests += 1;
        await route.fulfill(entry);
      } catch (error) {
        fontLog.failures.push(`${url}: ${error.message}`);
        await route.abort();
      }
    });
    if (generatedOrigin !== new URL(runner.url).origin) await context.route(`${generatedOrigin}/**`, (route) => route.continue());
  };

  const guiContext = await runner.newContext({ viewport: EDITOR_VIEWPORT, deviceScaleFactor: 1 });
  await allowExtra(guiContext);
  const generatedContext = await runner.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await allowExtra(generatedContext);
  const browserVersion = guiContext.browser()?.version();

  const results = [];
  const guiPages = new Map();
  for (const target of selected) {
    const screen = target.spec.pages?.[target.page];
    const inputIds = Object.entries(screen.nodes).filter(([, node]) => node.type === "input").map(([id]) => id);
    let gui = guiPages.get(target.file);
    if (!gui) {
      gui = await guiContext.newPage();
      gui.setDefaultTimeout(20000);
      const errors = [];
      gui.on("pageerror", (error) => errors.push(error.message));
      gui.errors = errors;
      await gui.goto(runner.url);
      await gui.getByRole("button").filter({ hasText: new RegExp(`${target.spec.name}.*페이지`, "s") }).click();
      await gui.getByRole("button", { name: "File", exact: true }).waitFor();
      guiPages.set(target.file, gui);
    }
    if (target.spec.pageOrder.length > 1) await gui.getByRole("button", { name: screen.name, exact: true }).click();
    await gui.locator(`[data-testid="responsive-artboard"] [data-node-id="${screen.root}"]`).waitFor();

    for (const check of target.checks) {
      for (const viewport of check.viewports) {
        const errors = [];
        if (screen.responsive) {
          await gui.getByLabel("미리보기 폭", { exact: true }).fill(String(viewport.width));
        }
        // 열 때의 자동 화면 맞춤 뒤에도 Ctrl+0으로 100%를 맞추고 배율을 DOM에서 확인한다.
        await gui.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
        const pageWidth = screen.responsive ? viewport.width : screen.size.width;
        const resetZoom = async () => {
          await gui.keyboard.press("Control+0");
          await gui.waitForFunction((width) => {
            const artboard = document.querySelector('[data-testid="responsive-artboard"]');
            return artboard && artboard.offsetWidth === width && Math.abs(artboard.getBoundingClientRect().width - width) < 0.01;
          }, pageWidth);
        };
        await resetZoom();
        const guiOptions = {
          scopeSelector: '[data-testid="responsive-artboard"]', shellSelector: '[data-testid="responsive-artboard"]',
          rootId: screen.root, viewport, documentScroll: false,
        };
        const guiCapture = await capture(gui, guiOptions, inputIds);
        // 대상마다 한 번은 축소한 Canvas에서도 재고, 배율을 되돌린 좌표가 100% 측정과 같은지 확인한다.
        let zoomCheck;
        if (check === target.checks[0] && viewport === check.viewports[0]) {
          await gui.keyboard.press("Control+Minus");
          await gui.waitForFunction(() => {
            const artboard = document.querySelector('[data-testid="responsive-artboard"]');
            return artboard && Math.abs(artboard.getBoundingClientRect().width / artboard.offsetWidth - 1) > 0.01;
          });
          const zoomed = await gui.evaluate(captureInPage, { ...guiOptions, inputIds });
          const maxDelta = Math.max(0, ...Object.entries(guiCapture.nodes).flatMap(([id, bounds]) =>
            ["x", "y", "width", "height"].map((key) => Math.abs(bounds[key] - (zoomed.nodes[id]?.[key] ?? Infinity)))));
          zoomCheck = { canvasZoomPercent: zoomed.viewport.canvasZoomPercent, maxDelta };
          if (!(maxDelta <= TOLERANCE_CSS_PX)) errors.push(`GUI zoom-corrected bounds differ by ${maxDelta} at ${zoomCheck.canvasZoomPercent}%`);
          await resetZoom();
        }

        const generated = await generatedContext.newPage();
        generated.setDefaultTimeout(20000);
        const generatedErrors = [];
        generated.on("pageerror", (error) => generatedErrors.push(error.message));
        await generated.setViewportSize(viewport);
        await generated.goto(generatedTemplate.replace("{page}", encodeURIComponent(external ? screen.name : check.generated)));
        await generated.locator(`[data-node-id="${screen.root}"]`).waitFor();
        const generatedCapture = await capture(generated, {
          scopeSelector: null, shellSelector: ".vsb-page", rootId: screen.root, viewport, documentScroll: true,
        }, inputIds);
        await generated.close();

        // 같은 스펙의 보여야 할 노드가 GUI에 모두 그려졌는지, ID가 비거나 겹치지 않는지 따로 확인한다.
        const expectedIds = visibleSpecIds(screen);
        const guiIds = Object.keys(guiCapture.nodes).sort();
        if (JSON.stringify(expectedIds) !== JSON.stringify(guiIds)) errors.push(`GUI ids ${JSON.stringify(guiIds)} != spec ${JSON.stringify(expectedIds)}`);
        for (const [label, measured, pageErrors] of [["GUI", guiCapture, gui.errors], ["generated", generatedCapture, generatedErrors]]) {
          if (measured.duplicateIds.length > 0) errors.push(`${label} duplicate data-node-id: ${measured.duplicateIds}`);
          if (measured.emptyIds > 0) errors.push(`${label} empty data-node-id: ${measured.emptyIds}`);
          if (pageErrors.length > 0) errors.push(`${label} page errors: ${pageErrors.splice(0).join(" | ")}`);
        }
        if (Math.abs(guiCapture.shell.width - pageWidth) > 0.01) errors.push(`GUI artboard width ${guiCapture.shell.width} != ${pageWidth}`);
        const comparison = compareMeasurements(readMeasurement(guiCapture, "GUI"), readMeasurement(generatedCapture, "generated"));
        errors.push(...comparison.errors);
        const rootRow = comparison.rows.find((row) => row.id === screen.root);
        const expectedFailure = check.expectFailure === "root";
        const verdict = comparison.loadErrors.length > 0 ? "invalid"
          : expectedFailure ? (errors.length > 0 && rootRow && !rootRow.passed ? "expected-fail" : "unexpected-pass")
            : errors.length === 0 ? "pass" : "fail";
        if (verdict === "invalid") exitCode = 3;
        else if ((verdict === "fail" || verdict === "unexpected-pass") && exitCode === 0) exitCode = 1;
        const bounds = (measured) => {
          const { x, y, width, height } = measured.nodes[screen.root];
          return { x, y, width, height };
        };
        results.push({
          case: check.generated, page: target.page, viewport, verdict,
          root: { gui: bounds(guiCapture), generated: bounds(generatedCapture) },
          shell: { gui: guiCapture.shell, generated: generatedCapture.shell ?? null },
          documentScrollHeight: generatedCapture.documentScrollHeight,
          nodesCompared: comparison.nodesCompared,
          ...(zoomCheck ? { zoomCheck } : {}),
          maxDelta: Math.max(0, ...comparison.rows.flatMap((row) => Object.values(row.delta))),
          lines: Object.fromEntries(Object.entries(guiCapture.nodes).filter(([, node]) => node.lines !== undefined)
            .map(([id, node]) => [id, [node.lines, generatedCapture.nodes[id]?.lines]])),
          placeholders: { gui: guiCapture.placeholders, generated: generatedCapture.placeholders },
          images: { gui: guiCapture.images, generated: generatedCapture.images },
          renderedFonts: {
            gui: [...new Set(Object.values(guiCapture.renderedFonts).flat().map((font) => `${font.familyName}${font.isCustomFont ? " (web)" : " (local)"}`))],
            generated: [...new Set(Object.values(generatedCapture.renderedFonts).flat().map((font) => `${font.familyName}${font.isCustomFont ? " (web)" : " (local)"}`))],
            unavailable: [...guiCapture.renderedFontsUnavailable, ...generatedCapture.renderedFontsUnavailable],
          },
          hiddenNodeIds: { gui: guiCapture.hiddenNodeIds, generated: generatedCapture.hiddenNodeIds },
          rows: comparison.rows.map(({ id, delta }) => ({ id, gui: guiCapture.nodes[id], generated: generatedCapture.nodes[id], delta })),
          loadErrors: comparison.loadErrors,
          errors,
        });
        const root = results.at(-1).root;
        console.log(`${verdict.toUpperCase()} ${check.generated} ${viewport.width}x${viewport.height} root GUI ${root.gui.width}x${root.gui.height} / generated ${root.generated.width}x${root.generated.height}, nodes ${comparison.nodesCompared}, max delta ${results.at(-1).maxDelta}${errors.length || comparison.loadErrors.length ? `\n  ${[...comparison.loadErrors, ...errors].join("\n  ")}` : ""}`);
      }
    }
  }

  const fontCss = fontCache.get(`${PRETENDARD}dist/web/static/pretendard-dynamic-subset.css`)
    ?? [...fontCache.entries()].find(([url]) => url.endsWith(".css"))?.[1];
  const report = {
    method: external
      ? `실제 GUI 아트보드 DOM 대 지정한 생성 결과(${args["generated-url"] ?? args["generated-dir"]})`
      : "실제 GUI 아트보드 DOM 대 수동 매핑 fixture(test/fixtures/layout-parity, Vite + Tailwind v4). 실제 AI 출력 아님",
    environment: {
      platform: process.platform, node: process.version, chromium: browserVersion, devicePixelRatio: 1,
      editorWindow: EDITOR_VIEWPORT,
      fontCss: [...fontCache.keys()].filter((url) => url.endsWith(".css")),
      fontCssSha256: fontCss ? createHash("sha256").update(fontCss.body).digest("hex") : null,
      fontFilesFetched: [...fontCache.keys()].filter((url) => url.endsWith(".woff2")).length,
      fontRequestsServed: fontLog.requests, fontFailures: fontLog.failures,
    },
    summary: Object.fromEntries(["pass", "expected-fail", "fail", "unexpected-pass", "invalid"].map((verdict) =>
      [verdict, results.filter((result) => result.verdict === verdict).length])),
    results,
  };
  if (fontLog.failures.length > 0) exitCode = 3;
  if (args.out) await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`SUMMARY ${JSON.stringify(report.summary)} fonts ${report.environment.fontFilesFetched} files, failures ${fontLog.failures.length}`);
} finally {
  await runner?.close();
  await rm(workspace, { recursive: true, force: true });
  if (generatedRun) await rm(generatedRun, { recursive: true, force: true });
}
process.exitCode = exitCode;

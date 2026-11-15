// #350 회귀: 실제 Chromium에서 중첩 텍스트/CDP·폰트 실패·다중 이미지 캡처를 검증한다.
// 수동 DOM fixture이며 모델을 호출하지 않는다. CDN 연결 없이 실행한다.
import assert from "node:assert/strict";
import { capture } from "./layout-parity-capture.mjs";
import { compareMeasurements, exitCodeFor, readMeasurement } from "../compare-layout-measurements.mjs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await context.route("**/*", (route) => route.abort());
  const page = await context.newPage();
  const options = { scopeSelector: null, shellSelector: ".vsb-page", rootId: "root",
    expectedFontIds: ["title"], viewport: { width: 390, height: 844 }, documentScroll: true };
  await page.setContent(`<style>body{margin:0}.vsb-page{width:390px;min-height:844px}p{margin:0;font:20px/24px serif}</style>
    <main class="vsb-page"><div data-node-id="root"><p data-node-id="title"><span><b>first</b></span><br><span>second</span></p></div></main>`);
  const nested = readMeasurement(await capture(page, options, []), "nested");
  assert.equal(nested.nodes.title.lines, 2);
  assert.equal(nested.nodes.root.lines, undefined, "parent must not count a child IR node's text");
  assert.ok(nested.renderedFonts.title.length > 0, "nested text must have actual CDP evidence");
  assert.equal(exitCodeFor(compareMeasurements(nested, nested)), 3, "local fallback is invalid even with equal bounds");

  await page.addStyleTag({ content: `@font-face{font-family:Broken;src:url(https://fixture.invalid/broken.woff2)}[data-node-id=title]{font-family:Broken}` });
  const failedFont = readMeasurement(await capture(page, options, []), "failed font");
  assert.ok(failedFont.fontLoadErrors.length > 0, "document.fonts.load rejection must be retained");
  assert.equal(exitCodeFor(compareMeasurements(failedFont, failedFont)), 3);

  const svg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"/>')}`;
  await page.evaluate((url) => {
    document.querySelector('[data-node-id="root"]').style.backgroundImage = `url("${url}"), url("https://fixture.invalid/missing.png")`;
  }, svg);
  const images = readMeasurement(await capture(page, options, []), "images");
  assert.deepEqual(images.images.root, { loaded: true, naturalWidth: 1200, naturalHeight: 600 });
  assert.equal(images.images["root::background:1"].loaded, false);
  assert.ok(compareMeasurements(images, images).loadErrors.some((error) => error.includes("image root::background:1 did not load")));
  // CSS 박스는 유지하고 실제 이미지 소스의 가로/세로만 바꾼다.
  await page.evaluate((url) => {
    document.querySelector('[data-node-id="root"]').style.backgroundImage = `url("${url}")`;
  }, `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1200"/>')}`);
  const swapped = await capture(page, options, []);
  const intrinsicErrors = compareMeasurements(images, swapped).errors;
  assert.ok(intrinsicErrors.includes("image root.naturalWidth: 1200 != 600"));
  assert.ok(intrinsicErrors.includes("image root.naturalHeight: 600 != 1200"));
  await page.locator(".vsb-page").evaluate((element) => element.classList.remove("vsb-page"));
  const missingShell = await capture(page, options, []);
  assert.ok(compareMeasurements(nested, missingShell).errors.includes("shell measurement missing on one side"));
  console.log(JSON.stringify({ chromium: browser.version(), nestedLines: nested.nodes.title.lines,
    nestedFonts: nested.renderedFonts.title, fontLoadErrors: failedFont.fontLoadErrors, images: images.images, intrinsicErrors, missingShellDetected: true, passed: true }, null, 2));
} finally {
  await browser.close();
}

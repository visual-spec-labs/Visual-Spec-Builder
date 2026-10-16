import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}), args: ['--no-sandbox'] });
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (path.includes('..')) { res.writeHead(400); res.end(); return; }
  try { const bytes = await readFile(join(process.argv[2], path)); res.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript' }[extname(path)] || 'application/octet-stream'); res.end(bytes); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors = [];
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#navigate').click(); await page.locator('#dashboard').waitFor();
  await page.locator('#back').click(); await page.locator('#open').click();
  const panel = page.locator('.vsb-project-modal-content'); const dialog = page.locator('dialog[open]');
  await panel.waitFor(); const box = await panel.boundingBox();
  assert.equal(Math.round(box.width), 480); assert.equal(Math.round(box.height), 320);
  assert.equal(Math.round(box.x + box.width / 2), 720); assert.equal(Math.round(box.y + box.height / 2), 500);
  assert.equal(await panel.locator('[data-screen]').evaluate(el => el.offsetWidth), 480);
  assert.equal(await page.locator('#modal-title').evaluate(el => getComputedStyle(el).fontSize), '32px');
  await page.mouse.click(4, 500); assert.equal(await dialog.count(), 1);
  for (let index = 0; index < 8; index++) { await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true); }
  await panel.locator('[data-screen]').evaluate(el => { const spacer = document.createElement('div'); spacer.style.height = '2000px'; el.prepend(spacer); });
  await page.locator('#replace').focus(); assert.ok(await panel.evaluate(el => el.scrollTop) > 0);
  await page.locator('#replace').click(); await panel.locator('[data-screen="otherModal"]').waitFor(); assert.equal(await dialog.count(), 1);
  assert.equal(await panel.evaluate(el => el.scrollTop), 0);
  assert.equal(await dialog.getAttribute('aria-label'), 'OtherModal');
  await page.keyboard.press('Escape'); await panel.waitFor({ state: 'detached' });
  assert.equal(await page.locator('#open').evaluate(el => document.activeElement === el), true);
  await page.locator('#open').click(); await page.locator('#modal-navigate').click(); await page.locator('#dashboard').waitFor(); assert.equal(await dialog.count(), 0);
  await page.locator('#back').click(); await page.locator('#open').click();
  await page.setViewportSize({ width: 360, height: 240 }); await page.waitForFunction(() => document.querySelector('.vsb-project-modal-content').offsetWidth === 328);
  const small = await panel.boundingBox(); assert.equal(Math.round(small.width), 328); assert.ok(small.height <= 208);
  assert.equal(await page.locator('#modal-title').evaluate(el => getComputedStyle(el).fontSize), '20px');
  await page.locator('#close').click(); await panel.waitFor({ state: 'detached' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { const spacer = document.createElement('div'); spacer.style.height = '3000px'; document.body.append(spacer); document.body.style.overflow = 'auto'; document.documentElement.style.overflow = 'auto'; window.scrollTo(0,100); });
  await page.locator('#open').focus(); const scroll = await page.evaluate(() => window.scrollY);
  await page.locator('#open').press('Enter'); await panel.waitFor();
  await page.mouse.move(4, 500); await page.mouse.wheel(0, 600); await page.waitForTimeout(200); assert.equal(await page.evaluate(() => window.scrollY), scroll);
  await panel.locator('[data-screen]').evaluate(el => { const spacer = document.createElement('div'); spacer.style.height = '2000px'; el.prepend(spacer); });
  await page.locator('#close').focus(); assert.ok(await panel.evaluate(el => el.scrollTop) > 0);
  await panel.evaluate(el => { el.scrollTop = el.scrollHeight; }); const bottom = await panel.evaluate(el => el.scrollTop);
  const long = await panel.boundingBox(); await page.mouse.move(long.x + 5, long.y + 5); await page.mouse.wheel(0, 600); await page.waitForTimeout(200);
  assert.equal(await panel.evaluate(el => el.scrollTop), bottom); assert.equal(await page.evaluate(() => window.scrollY), scroll);
  await page.locator('#open').evaluate(el => el.remove()); await page.keyboard.press('Escape'); await panel.waitFor({ state: 'detached' });
  assert.equal(await page.locator('[data-vsb-project-host]').evaluate(el => document.activeElement === el), true);
  assert.equal(await page.evaluate(() => window.scrollY), scroll);
  assert.deepEqual(await page.evaluate(() => [document.documentElement.style.overflow, document.body.style.overflow]), ['auto', 'auto']);
  assert.deepEqual(errors, []);
  console.log('PASS generated runtime: typechecked production fixture; navigate, replace, Escape/close, backdrop, focus fallback, viewport sizing, scroll containment/restoration; no model execution');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

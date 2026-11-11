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
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('.shared-widget').first().waitFor();
  assert.deepEqual(await page.locator('.shared-widget').allTextContents(), ['first', 'second']);
  await page.locator('.shared-widget').nth(1).click();
  await page.locator('#dashboard').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS shared widget runtime: one shared source, two instances, navigation, typecheck/build; fixture only');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

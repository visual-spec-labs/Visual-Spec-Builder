import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}), args: ['--no-sandbox'] });
try {
  for (const prefix of ['/', '/products/demo/']) {
    const failures = []; const requests = [];
    const server = createServer(async (req, res) => {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (!path.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
      const relative = path.slice(prefix.length) || 'index.html';
      if (relative.includes('..')) { res.writeHead(400); res.end(); return; }
      try {
        const bytes = await readFile(join(process.argv[2], relative));
        res.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' }[extname(relative)] || 'application/octet-stream');
        requests.push(path); res.end(bytes);
      } catch { failures.push(path); res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const context = await browser.newContext();
    try {
      const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}${prefix}`);
      await page.locator('#host-image').waitFor();
      const result = await page.evaluate(async () => {
        const images = [...document.querySelectorAll('img')];
        const background = new Image(); background.src = getComputedStyle(document.getElementById('background')).backgroundImage.match(/url\("?(.*?)"?\)/)[1];
        images.push(background); await Promise.all(images.map(image => image.decode()));
        return images.map(image => ({ url: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight }));
      });
      assert.equal(result.length, 3); assert.equal(new Set(result.map(image => image.url)).size, 1);
      for (const image of result) { assert.equal(image.width, 2); assert.equal(image.height, 3); assert.ok(new URL(image.url).pathname.startsWith(`${prefix}assets/`)); }
      assert.ok(requests.some(path => path.endsWith('.svg'))); assert.deepEqual(errors, []);
      assert.deepEqual(failures.filter(path => path !== `${prefix}favicon.ico`), []);
    } finally { await context.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
  console.log('PASS root and nested: transformed page/host img and inline background decoded; assetsInlineLimit=0; source fixture, not GUI Export');
} finally { await browser.close(); }

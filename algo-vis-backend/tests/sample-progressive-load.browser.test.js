const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('sample deck enters before animation compilation and finishes rebuilding in the background', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const value = probe.address().port;
      probe.close(() => resolve(value));
    });
  });
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') },
    windowsHide: true,
    stdio: 'ignore'
  });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    let releaseCompile;
    const compileGate = new Promise(resolve => { releaseCompile = resolve; });
    await page.route('**/compile', async route => {
      await compileGate;
      await route.continue();
    });

    await page.goto(`${base}/slides.html?sample=quick-sort`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.title.includes('快速排序'));
    await page.waitForSelector('.slides section');
    assert.equal(await page.locator('body').getAttribute('data-asmdeck-rebuild'), 'loading');
    assert.ok(await page.locator('.slides section').count() > 1, 'deck is visible while compilation is blocked');
    assert.ok(await page.locator('.algorithm-slide-placeholder:not([hidden])').count() > 0,
      'pending algorithm slides show an in-deck loading state');

    releaseCompile();
    await page.waitForFunction(() => document.body.dataset.asmdeckRebuild === 'ready', null, { timeout: 90000 });
    assert.equal(await page.locator('body').getAttribute('data-asmdeck-rebuild-progress'), '2/2');
    assert.equal(await page.locator('.algorithm-slide-frame:not([hidden])').count(), 2);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});

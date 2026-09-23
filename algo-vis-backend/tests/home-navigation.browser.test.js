const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

async function startServer() {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const selected = probe.address().port;
      probe.close(() => resolve(selected));
    });
  });
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex') },
    windowsHide: true,
    stdio: 'ignore'
  });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(base)).ok) return { server, base }; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('test server did not start');
}

test('header and workspace sample navigation share their target and active state',
  { timeout: 90000 }, async () => {
    const { server, base } = await startServer();
    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
      });
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.route('**/guest-decks.json', route => route.fulfill({ json: { decks: [] } }));
      await page.goto(base);

      const headerSlides = page.locator('#headerSlidesLink');
      const headerExamples = page.locator('#headerExamplesLink');
      const workspaceSlides = page.locator('#workspaceSlidesNav');
      const workspaceExamples = page.locator('#workspaceExamplesNav');
      assert.equal(await headerExamples.getAttribute('href'), '/?examples=1');
      assert.equal(await workspaceExamples.getAttribute('href'), '/?examples=1');
      assert.equal(await headerSlides.getAttribute('aria-current'), 'page');
      assert.equal(await workspaceSlides.getAttribute('aria-current'), 'page');
      assert.equal(await headerExamples.getAttribute('aria-current'), null);
      assert.equal(await workspaceExamples.getAttribute('aria-current'), null);

      await headerExamples.click();
      await page.waitForURL(`${base}/?examples=1`);
      assert.equal(await headerSlides.getAttribute('aria-current'), null);
      assert.equal(await workspaceSlides.getAttribute('aria-current'), null);
      assert.equal(await headerExamples.getAttribute('aria-current'), 'page');
      assert.equal(await workspaceExamples.getAttribute('aria-current'), 'page');
      assert.equal(await page.locator('.auth-panel').isVisible(), false);

      await headerSlides.click();
      await page.waitForURL(`${base}/`);
      assert.equal(await headerSlides.getAttribute('aria-current'), 'page');
      assert.equal(await workspaceSlides.getAttribute('aria-current'), 'page');
    } finally {
      await browser?.close();
      server.kill();
    }
  });
